// Ported from MathTestBuddy trainer/src/lib/mcp/server.ts. Kept: stateless Streamable HTTP (a fresh
// McpServer and transport per request, JSON response mode, both closed once the Response is built),
// the bearer checked first so an unauthenticated caller cannot tell a live segment from a dead one,
// then a segment that must name an open job (else 404), the body left unread for the transport.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { type Now, segmentJob } from "../ai/jobs";
import type { Db } from "../db/handle";
import { tokensMatch } from "../http/guard";
import { registerTools } from "./tools";

/**
 * The app's MCP surface (design §7.4; manifest ai.mcp): /api/mcp and /api/mcp/t/<segment>. The
 * platform connects with `Authorization: Bearer <the MCP secret this app registered>`; each job's
 * agent is pointed at its own segment. The static path serves no job, so every tool refuses there.
 */

export const MCP_SERVER_INFO = Object.freeze({ name: "mathviz", version: "0.1.0" });

export interface McpRequestContext {
  db: Db;
  contentDir: string | null;
  mcpToken: string | null;
  /** The <segment> of /api/mcp/t/<segment>, or null for /api/mcp. */
  segment: string | null;
  now?: Now;
}

function bearerToken(req: Request): string | undefined {
  const [scheme, token] = String(req.headers.get("authorization") ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** Handle one MCP request. The request body must not have been consumed. */
export async function handleMcpRequest(
  req: Request,
  { db, contentDir, mcpToken, segment, now = () => new Date().toISOString() }: McpRequestContext,
): Promise<Response> {
  if (!tokensMatch(bearerToken(req), mcpToken)) {
    return json(401, { error: { code: "unauthorised", message: "error.unauthorised" } });
  }
  let jobId: string | null = null;
  if (segment !== null) {
    const job = segmentJob(db, segment, { now });
    if (!job) return json(404, { error: { code: "not_found", message: "error.not_found" } });
    jobId = job.id;
  }
  const server = new McpServer(MCP_SERVER_INFO);
  registerTools(server, { db, contentDir, jobId, now });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch {
    return json(500, { error: { code: "internal", message: "error.internal" } });
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}
