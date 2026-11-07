// Ported from MathTestBuddy trainer/src/lib/mcp/tools.ts. Kept: every call authorised on the
// server (the ticket must belong to the job behind the request's path segment, the job must be
// open, the tool must be allowed for the job — Codex jobs have no platform allow-list), refusals
// and format problems going back as tool-error text, the agent learning only "Accepted.". Changed:
// the tools are this app's five, the allow-list is per workflow (the manifest's `tools.allow`), and
// the ticketless tools (search, read, list) are authorised by the path segment alone.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildTask, forbiddenForJob, listGroups, readItem } from "../ai/context";
import {
  acceptAnswer,
  inputOf,
  type JobsPlatform,
  jobAcceptsCalls,
  MAX_ANSWER_CHARS,
  type Now,
  recordReadProgram,
  type Workflow,
} from "../ai/jobs";
import { leakCheck } from "../ai/leak";
import { searchLibrary } from "../content/search";
import type { Db } from "../db/handle";
import type { AiJobRow } from "../db/schema";

/**
 * The MCP tools the agent calls back (design §7.4, §7.5). `mv_submit_answer` is where the anti-leak
 * rule is enforced, whatever the agent was given or claims (`revealsAnswer` is accepted and
 * ignored): an answer containing an answer line of a blank the student may not see yet is refused,
 * and the second such answer fails the job ('needs-blank-done').
 */

export const TOOL_NAMES = [
  "mv_get_task",
  "mv_search_library",
  "mv_read_item",
  "mv_list_groups",
  "mv_submit_answer",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** Each workflow's tools: the manifest's `tools.allow`, enforced here as well (tests compare). */
export const WORKFLOW_TOOLS: Readonly<Record<Workflow, readonly ToolName[]>> = Object.freeze({
  ask: Object.freeze(["mv_get_task", "mv_read_item", "mv_submit_answer"] as const),
  hint: Object.freeze(["mv_get_task", "mv_submit_answer"] as const),
  library: Object.freeze([...TOOL_NAMES]),
});

export const LEAK_REFUSAL = "answer reveals a blank that is not allowed yet; rewrite without it";

export type AuthError = "no_job" | "unknown_ticket" | "job_closed" | "wrong_workflow";

const REFUSALS: Record<AuthError, string> = {
  no_job: "Refused: this endpoint serves no job. Use the MCP address your job was given.",
  unknown_ticket: "Refused: unknown ticket. Use the ticket from your instruction.",
  job_closed: "Refused: this job is no longer accepting calls.",
  wrong_workflow: "Refused: this tool is not allowed for this job.",
};

const getRow = (db: Db, id: string) =>
  db.prepare("SELECT * FROM ai_jobs WHERE id = ?").get<AiJobRow>(id);

/**
 * The checks for one tool call: a job behind the path segment, still open, whose workflow allows
 * the tool, and — for the tools that take one — the ticket of that very job. The row is re-read,
 * so a job that ended during this request refuses further calls.
 */
export function authorise(
  db: Db,
  segmentJobId: string | null,
  tool: ToolName,
  { ticket, now }: { ticket?: unknown; now: Now },
): { job: AiJobRow } | { error: AuthError } {
  if (!segmentJobId) return { error: "no_job" };
  const job = getRow(db, segmentJobId);
  if (!job) return { error: "no_job" };
  if (ticket !== undefined && (typeof ticket !== "string" || ticket !== job.ticket)) {
    return { error: "unknown_ticket" };
  }
  if (!jobAcceptsCalls(job, now)) return { error: "job_closed" };
  const allowed = (WORKFLOW_TOOLS as Record<string, readonly string[] | undefined>)[job.workflow];
  if (!allowed?.includes(tool)) return { error: "wrong_workflow" };
  return { job };
}

interface ToolReply {
  [k: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

const reply = (text: string, isError = false): ToolReply => ({
  content: [{ type: "text", text }],
  ...(isError ? { isError: true } : {}),
});
const json = (v: unknown) => reply(JSON.stringify(v, null, 2));

export interface ToolContext {
  db: Db;
  /** The content pack's payload directory; null when none is installed. */
  contentDir: string | null;
  /** The job behind the request's /api/mcp/t/<segment>, or null (the static /api/mcp). */
  jobId: string | null;
  now: Now;
  /** For cancelling a job that ended on our side (needs-blank-done); null outside PrimeForge. */
  platform?: JobsPlatform | null;
}

export const SEARCH_LIMIT_MAX = 20;

/** Register the five tools on an McpServer for one request. */
export function registerTools(
  server: McpServer,
  { db, contentDir, jobId, now, platform = null }: ToolContext,
) {
  const gate = (tool: ToolName, ticket?: unknown) =>
    authorise(db, jobId, tool, { ticket: ticket ?? undefined, now });
  const ticket = z.string().describe("The ticket from your instruction.");

  server.registerTool(
    "mv_get_task",
    {
      description: "Get the student's question and the material for your job. Call this first.",
      inputSchema: { ticket },
    },
    async ({ ticket: t }) => {
      const g = gate("mv_get_task", t);
      if ("error" in g) return reply(REFUSALS[g.error], true);
      try {
        return json(buildTask(db, contentDir, g.job));
      } catch {
        return reply("The task is not available right now.", true);
      }
    },
  );

  server.registerTool(
    "mv_search_library",
    {
      description:
        "Search this app's library (pages and programs). Returns item ids, titles and snippets. Terms are ANDed; Chinese and English both work.",
      inputSchema: {
        query: z.string().describe("Search terms, separated by spaces."),
        limit: z
          .number()
          .int()
          .optional()
          .describe(`At most this many hits (1–${SEARCH_LIMIT_MAX}, default 8).`),
      },
    },
    async ({ query, limit }) => {
      const g = gate("mv_search_library");
      if ("error" in g) return reply(REFUSALS[g.error], true);
      const n = Math.min(SEARCH_LIMIT_MAX, Math.max(1, Math.trunc(limit ?? 8)));
      return json({ hits: searchLibrary(db, query, n) });
    },
  );

  server.registerTool(
    "mv_read_item",
    {
      description:
        "Read one library item in full, by id (program:<id> or tool:<id>). Blanks the student has not uncovered are shown as placeholders.",
      inputSchema: {
        id: z.string().describe("The item id, as mv_search_library or the task gives it."),
      },
    },
    async ({ id }) => {
      const g = gate("mv_read_item");
      if ("error" in g) return reply(REFUSALS[g.error], true);
      // a program other than the one open on the page reads as "nothing allowed": allowedBlanks
      // gives the pyState's rules to its own program only
      const item = readItem(db, contentDir, id, inputOf(g.job).pyState);
      if (!item) return reply(`No such item: ${id}`, true);
      if (item.kind === "program" && "programId" in item) {
        recordReadProgram(db, g.job.id, item.programId);
      }
      return json(item);
    },
  );

  server.registerTool(
    "mv_list_groups",
    { description: "List the app's groups and the pages in each.", inputSchema: {} },
    async () => {
      const g = gate("mv_list_groups");
      if ("error" in g) return reply(REFUSALS[g.error], true);
      return json({ groups: listGroups(db) });
    },
  );

  server.registerTool(
    "mv_submit_answer",
    {
      description: "Submit your reply to the student. Call once; resubmit only if refused.",
      inputSchema: {
        ticket,
        text: z.string().describe("The reply, in Markdown."),
        citations: z
          .array(z.string())
          .describe("Ids of the library items you relied on (program:<id>, tool:<id>)."),
        revealsAnswer: z
          .boolean()
          .optional()
          .describe("True if the reply states or gives away a hidden blank's code."),
      },
    },
    async ({ ticket: t, text, citations }) => {
      const g = gate("mv_submit_answer", t);
      if ("error" in g) return reply(REFUSALS[g.error], true);
      const body = text.trim();
      if (!body) return reply("Rejected: the text is empty.", true);
      if (body.length > MAX_ANSWER_CHARS) {
        return reply(`Rejected: the text is longer than ${MAX_ANSWER_CHARS} characters.`, true);
      }
      // the only check that holds for every engine: the server's own, never the agent's claim
      const leak = leakCheck(body, forbiddenForJob(contentDir, g.job));
      const out = acceptAnswer(db, g.job.id, { text: body, citations, leak }, { now });
      if (out.accepted) return reply("Accepted.");
      if (out.reason === "job_closed") return reply(REFUSALS.job_closed, true);
      if (out.failed && g.job.platform_job_id && platform?.cancelJob) {
        // our job has ended; stop the platform's too (POST /ai/jobs/:id/cancel), best effort —
        // poll settles it either way
        try {
          await platform.cancelJob(g.job.platform_job_id);
        } catch {
          // the platform's own limits end it
        }
      }
      return reply(
        out.failed
          ? `${LEAK_REFUSAL}. This was the second refusal: the job has ended.`
          : LEAK_REFUSAL,
        true,
      );
    },
  );
}
