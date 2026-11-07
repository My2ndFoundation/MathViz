/**
 * The integration suite's fake PrimeForge platform (tests/integration/fake-platform.ts) as a
 * process, for the e2e specs: Playwright runs under Node, the fake (and the MCP SDK client its
 * agents use) under Bun.
 *
 *   bun tests/e2e/fake-platform-server.ts <appPort>   → one JSON line {url, secret}, then serves
 *                                                       until it is killed
 *
 * The app is pointed at it the way PrimeForge points it at the real one: PRIMEFORGE_API_URL and
 * PRIMEFORGE_API_SECRET. Nothing in the app knows it is a fake, so no test-only hook ships.
 *
 * Agents: `ask` and `hint` are the integration suite's well-behaved tutor (it cites its subject);
 * an `ask` question containing "[hold]" is held open until the job is cancelled (below).
 * `library` searches with the student's question, cites the first program it finds and the first
 * tool, and links once inside the app and once outside it (the page must show the outside one as
 * text).
 */
import { type Agent, DEFAULT_AGENTS, startFakePlatform } from "../integration/fake-platform";

const appPort = Number(process.argv[2]);
if (!Number.isInteger(appPort) || appPort <= 0) {
  console.error("usage: bun tests/e2e/fake-platform-server.ts <appPort>");
  process.exit(2);
}

const library: Agent = async ({ task, call, callT }) => {
  const s = await call("mv_search_library", { query: String(task.question ?? ""), limit: 8 });
  let hits: { id: string }[] = [];
  try {
    hits = (JSON.parse(s.text) as { hits: { id: string }[] }).hits;
  } catch {
    // no hits
  }
  const program = hits.find((h) => h.id.startsWith("program:"));
  const tool = hits.find((h) => h.id.startsWith("tool:"));
  return callT("mv_submit_answer", {
    text: [
      "The library has a worked program for this; open it from the list below.",
      "",
      "More in [your notes](/en/notes), or the [Python docs](https://docs.python.org/3/).",
    ].join("\n"),
    citations: [program?.id, tool?.id].filter((x): x is string => typeof x === "string"),
    revealsAnswer: false,
  });
};

/**
 * `ask`: the well-behaved tutor, except that a question containing "[hold]" is held open — the
 * agent waits, answering nothing, until the platform job ends (cancelled from the app) or two
 * minutes pass. The AI-queue spec uses it to see a job waiting or running.
 */
const ENDED = new Set(["completed", "succeeded", "failed", "timed_out", "cancelled"]);
const ask: Agent = async (a) => {
  if (!String(a.task.question ?? "").includes("[hold]")) return DEFAULT_AGENTS.ask?.(a);
  const until = Date.now() + 120_000;
  while (!ENDED.has(a.job.status) && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 100));
  }
};

const fake = await startFakePlatform({ appPort, agents: { ask, library } });
console.log(JSON.stringify({ url: fake.url, secret: fake.secret }));

const stop = async () => {
  await fake.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
