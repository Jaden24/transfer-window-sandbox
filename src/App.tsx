import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { CLUBS } from './data/clubs';
import * as store from './engine/store';
import PlanPanel from './components/PlanPanel';
import PsrPanel from './components/PsrPanel';
import SquadPanel from './components/SquadPanel';
import ToolsPanel from './components/ToolsPanel';
import { isWebMcpAvailable, registerTools, type RegistrationResult } from './webmcp/adapter';
import { TOOLS } from './webmcp/tools';

export default function App() {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const report = useMemo(() => store.compliance(state.plan), [state.plan, state.clubId]);

  const [registration, setRegistration] = useState<RegistrationResult>({
    mode: 'unavailable',
    registered: [],
  });

  // Register once, on mount. Tools read live state through the store, so they
  // never need re-registering when the plan changes.
  useEffect(() => {
    setRegistration(registerTools(TOOLS));
  }, []);

  const live = registration.mode !== 'unavailable';
  const club = store.currentClub();

  return (
    <div className="app">
      <header className="top">
        <div>
          <div className="brand">Transfer Window <span>Sandbox</span></div>
          <div className="tagline">
            The agent runs your window. The page enforces the rules.
          </div>
        </div>

        <div className="spacer" />

        <select
          value={state.clubId}
          onChange={(e) => store.selectClub(e.target.value)}
          title="Switch club"
        >
          {CLUBS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <span className={`badge ${live ? 'live' : 'warn'}`} title={
          live
            ? `Tools registered via ${registration.mode}()`
            : 'navigator.modelContext not found — run Chrome with the WebMCP origin trial, or use the manual tool runner'
        }>
          <span className="dot" />
          {live ? `WebMCP live · ${TOOLS.length} tools` : `No agent attached · ${TOOLS.length} tools ready`}
        </span>
      </header>

      <div className="disclaimer">
        <strong>Illustrative data.</strong> The PSR, amortisation and squad-registration
        rules modelled here are real and public. Every financial figure attached to a
        club or player is invented for demonstration and is not a reported number.
        Nothing here is financial advice, and no transfer is real.
      </div>

      <div className="columns">
        <div className="col">
          <PsrPanel report={report} />
        </div>

        <div className="col">
          <SquadPanel state={state} />
          <div className="panel">
            <h2>How this works</h2>
            <p className="hint" style={{ margin: 0 }}>
              Every figure the agent can state about {club.shortName}’s finances comes
              back from a tool on this page — it is not allowed to do the arithmetic
              itself, because amortisation and PSR headroom are exactly the sums a
              language model gets confidently wrong. Ask it to sign someone you cannot
              afford and the page refuses, with the numbers. Ask it to submit an illegal
              squad and it cannot. Ask it to submit a legal one and it still cannot —
              that button is yours.
            </p>
          </div>
        </div>

        <div className="col">
          <PlanPanel state={state} report={report} />
          <ToolsPanel registration={registration} />
        </div>
      </div>
    </div>
  );
}

// Surface availability for quick console checks during a demo.
(globalThis as any).__webmcpAvailable = isWebMcpAvailable;
