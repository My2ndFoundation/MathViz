import { serveMcp } from "@/lib/mcp/route";

/**
 * MCP Streamable HTTP (manifest ai.mcp): /api/mcp (path, serves no job) and /api/mcp/t/<segment>
 * (jobPathPrefix: one job's own path). Stateless and bearer-checked (lib/mcp/server.ts).
 */
export const dynamic = "force-dynamic";

async function handle(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return serveMcp(req, path);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
