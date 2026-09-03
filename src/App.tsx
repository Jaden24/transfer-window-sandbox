import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { CLUBS } from './data/clubs';
import * as store from './engine/store';
import PlanPanel from './components/PlanPanel';
import PsrPanel from './components/PsrPanel';
import SquadPanel from './components/SquadPanel';
import ToolsPanel from './components/ToolsPanel';
import { CurrencyContext, USD_PER_GBP, type Currency } from './engine/money';
import { isWebMcpAvailable, registerTools, type RegistrationResult } from './webmcp/adapter';
import { TOOLS } from './webmcp/tools';

export default function App() {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const report = useMemo(() => store.compliance(state.plan), [state.plan, state.clubId]);

  const [registration, setRegistration] = useState<RegistrationResult>({
    mode: 'unavailable',
    registered: [],
  });

  // Display currency only. The tools and the rules engine always speak pounds.
  const [currency, setCurrency] = useState<Currency>(() => {
    try {
      return localStorage.getItem('twsCurrency') === 'USD' ? 'USD' : 'GBP';
    } catch {
      return 'GBP';
    }
  });
  useEffect(() => {
    try { localStorage.setItem('twsCurrency', currency); } catch { /* private mode */ }
  }, [currency]);

  // Register once, on mount. Tools read live state through the store, so they
  // never need re-registering when the plan changes.
  useEffect(() => {
    setRegistration(registerTools(TOOLS));
  }, []);

  const live = registration.mode !== 'unavailable';
  const club = store.currentClub();

  return (
    <CurrencyContext.Provider value={currency}>
    <div className="app">
      <header className="top">
        <div>
          <div className="brand">Transfer Window <span>Sandbox</span></div>
          <div className="tagline">
            The agent runs your window. The page enforces the rules.
          </div>
        </div>

        <div className="spacer" />

        <button
          onClick={() => setCurrency((c) => (c === 'GBP' ? 'USD' : 'GBP'))}
          title={
            currency === 'GBP'
              ? `Show figures in US dollars (approx. $${USD_PER_GBP} per £1)`
              : 'Show figures in pounds — the currency the rules are written in'
          }
        >
          {currency === 'GBP' ? '£ → $' : '$ → £'}
        </button>

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
        {currency === 'USD' && (
          <> Dollar figures are converted at an approximate ${USD_PER_GBP}/£1 for
          readability; PSR is denominated in pounds and the tools always return pounds.</>
        )}
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
    </CurrencyContext.Provider>
  );
}

// Surface availability for quick console checks during a demo.
(globalThis as any).__webmcpAvailable = isWebMcpAvailable;
