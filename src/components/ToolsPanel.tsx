import { useState } from 'react';
import { TOOLS, TOOL_TIERS } from '../webmcp/tools';
import type { RegistrationResult } from '../webmcp/adapter';

const PROMPTS = [
  'What is my PSR position, and how much can I actually spend?',
  'I need a striker. Find me the best one I can afford.',
  'Sign Victor Osimhen on a five-year deal.',
  'Who should I sell to make room? Rank them by PSR impact.',
  'Balance the books, then submit the window.',
];

/**
 * Manual tool runner.
 *
 * WebMCP is an origin trial, so a reviewer may well open this page in a browser
 * with no agent attached. Rather than show them a dead app, every tool can be
 * invoked by hand here against the identical code path an agent would hit.
 */
function ToolRow({ tool }: { tool: (typeof TOOLS)[number] }) {
  const [args, setArgs] = useState('{}');
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tier = TOOL_TIERS[tool.name] ?? 'read';

  async function run() {
    setBusy(true);
    try {
      const parsed = args.trim() ? JSON.parse(args) : {};
      const result = await tool.execute(parsed);
      setOut(result.content.map((c) => c.text).join('\n'));
    } catch (err) {
      setOut(`Invalid arguments: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const props = (tool.inputSchema as any)?.properties ?? {};
  const hasArgs = Object.keys(props).length > 0;

  return (
    <details className="tool">
      <summary>
        <span className={`tier ${tier}`}>{tier}</span>
        <code>{tool.name}</code>
      </summary>
      <div className="body">
        <p style={{ margin: '0 0 7px' }}>{tool.description}</p>
        {hasArgs && (
          <>
            <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>
              arguments: {Object.keys(props).join(', ')}
            </div>
            <input
              style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              spellCheck={false}
            />
          </>
        )}
        <button onClick={run} disabled={busy} style={{ marginTop: 7, fontSize: 11.5 }}>
          {busy ? 'Running…' : 'Run tool'}
        </button>
        {out && <pre>{out}</pre>}
      </div>
    </details>
  );
}

export default function ToolsPanel({ registration }: { registration: RegistrationResult }) {
  const tiers = ['read', 'reversible', 'gated'] as const;
  const labels = {
    read: 'Read-only — safe to call freely',
    reversible: 'Reversible — changes the plan, always undoable',
    gated: 'Consequential — needs a human hand',
  };

  return (
    <>
      <div className="panel">
        <h2>Try saying</h2>
        <div className="prompts">
          {PROMPTS.map((p, i) => (
            <button
              className="prompt"
              key={p}
              onClick={() => navigator.clipboard?.writeText(p)}
              title="Copy to clipboard"
            >
              <span className="n">{i + 1}.</span>{p}
            </button>
          ))}
        </div>
        <p className="hint">
          Click to copy, then say it to the agent driving this page. The demo runs
          top to bottom.
        </p>
      </div>

      <div className="panel">
        <h2>
          WebMCP tools <span className="count">{TOOLS.length} registered</span>
        </h2>
        <p className="hint" style={{ margin: '0 0 10px' }}>
          {registration.mode === 'unavailable'
            ? 'No agent attached to this page. You can still run every tool by hand below — it is the same code path an agent uses.'
            : `Registered via ${registration.mode}(). An attached agent can call all ${TOOLS.length}.`}
        </p>

        {tiers.map((tier) => (
          <div key={tier} style={{ marginBottom: 11 }}>
            <div style={{ fontSize: 11, color: 'var(--faint)', margin: '0 0 5px' }}>
              {labels[tier]}
            </div>
            {TOOLS.filter((t) => TOOL_TIERS[t.name] === tier).map((t) => (
              <ToolRow key={t.name} tool={t} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
