/**
 * A thin compatibility layer over the WebMCP browser API.
 *
 * The API is an origin trial and is still moving. Two things differ between the
 * W3C proposal and the Chrome documentation as of this build:
 *
 *   - the entry point is `navigator.modelContext` in the proposal and
 *     `document.modelContext` in the Chrome guides;
 *   - registration is either `registerTool(tool)` per tool, or a single bulk
 *     `provideContext({ tools })` call.
 *
 * Rather than bet on one, we detect what is present and use it. Everything else
 * in the app talks to `registerTools()` and never touches the raw API, so when
 * the spec settles there is exactly one file to change.
 */

export interface ToolResultContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolResultContent[];
  /** Set when the page is refusing the call. Agents surface this as an error. */
  isError?: boolean;
}

/**
 * Standard MCP behaviour hints. These are advisory — a client may use them to
 * decide whether to ask the user before calling — so we set them honestly and
 * still enforce everything in the tool bodies. Chrome's guidance calls out
 * `readOnlyHint` specifically for tools that don't change state.
 */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  /** Set when a result carries user-generated or externally sourced content. */
  untrustedContentHint?: boolean;
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute: (args: any, ctx?: { signal?: AbortSignal }) => Promise<ToolResult> | ToolResult;
}

type ModelContextLike = {
  registerTool?: (tool: unknown) => unknown;
  unregisterTool?: (name: string) => unknown;
  provideContext?: (ctx: { tools: unknown[] }) => unknown;
};

function getModelContext(): ModelContextLike | null {
  const nav = (globalThis as any).navigator?.modelContext;
  if (nav) return nav as ModelContextLike;
  const doc = (globalThis as any).document?.modelContext;
  if (doc) return doc as ModelContextLike;
  return null;
}

export type RegistrationMode = 'registerTool' | 'provideContext' | 'unavailable';

export interface RegistrationResult {
  mode: RegistrationMode;
  registered: string[];
}

/** True when a WebMCP-capable browser is driving the page. */
export function isWebMcpAvailable(): boolean {
  return getModelContext() !== null;
}

/**
 * Wrap a handler so a thrown error becomes a clean MCP error result rather than
 * an unhandled rejection the agent cannot interpret. A tool that fails silently
 * is worse than one that refuses loudly.
 */
function guard(tool: WebMcpTool): WebMcpTool {
  return {
    ...tool,
    execute: async (args: unknown, ctx?: { signal?: AbortSignal }) => {
      try {
        return await tool.execute(args, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text: `${tool.name} failed: ${message}`,
          }],
        };
      }
    },
  };
}

export function registerTools(tools: WebMcpTool[]): RegistrationResult {
  const ctx = getModelContext();
  const guarded = tools.map(guard);

  if (!ctx) return { mode: 'unavailable', registered: [] };

  if (typeof ctx.registerTool === 'function') {
    for (const tool of guarded) ctx.registerTool(tool);
    return { mode: 'registerTool', registered: guarded.map((t) => t.name) };
  }

  if (typeof ctx.provideContext === 'function') {
    ctx.provideContext({ tools: guarded });
    return { mode: 'provideContext', registered: guarded.map((t) => t.name) };
  }

  return { mode: 'unavailable', registered: [] };
}

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

/**
 * Tool responses are read by a model, so they are JSON, not prose. Chrome's
 * guidance is explicit about this: return structured data with only the fields
 * needed to decide the next step.
 */
export function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/**
 * A refusal. `isError` matters: it is the difference between the agent thinking
 * it succeeded and the agent knowing it has to try something else.
 */
export function refuse(reason: string, data?: unknown): ToolResult {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: JSON.stringify({ refused: true, reason, ...(data ? { detail: data } : {}) }, null, 2),
    }],
  };
}
