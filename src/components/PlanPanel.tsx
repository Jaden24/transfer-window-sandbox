import { playerById } from '../data/players';
import { fmtMoney } from '../engine/rules';
import * as store from '../engine/store';
import type { AppState } from '../engine/store';
import type { ComplianceReport } from '../engine/types';

export default function PlanPanel({
  state, report,
}: { state: AppState; report: ComplianceReport }) {
  const feesOut = state.plan
    .filter((m) => m.kind === 'signing')
    .reduce((n, m) => n + m.fee, 0);
  const feesIn = state.plan
    .filter((m) => m.kind === 'sale')
    .reduce((n, m) => n + m.fee, 0);

  const hard = report.violations.filter((v) => v.severity === 'hard');
  const advisory = report.violations.filter((v) => v.severity === 'advisory');

  return (
    <>
      {state.submitted && (
        <div className="submitted">
          <strong>Window submitted.</strong> The plan was compliant and you confirmed it
          yourself. Nothing was submitted on your behalf.
        </div>
      )}

      {state.awaitingConfirmation && !state.submitted && (
        <div className="gate">
          <h3>The agent is asking to submit this window</h3>
          <p>
            The plan is compliant, so the agent has requested submission — but it cannot
            complete this itself. Registering a squad is the one action here with real
            consequences, so it needs your hand on it.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => store.confirmSubmission()}>
              Confirm &amp; submit
            </button>
            <button onClick={() => store.cancelSubmission()}>Not yet</button>
          </div>
        </div>
      )}

      <div className={`legal-banner ${report.legal ? 'ok' : 'bad'}`}>
        {report.legal ? '✓ Plan is compliant' : '✕ Plan breaks the rules'}
        <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12 }}>
          net {fmtMoney(feesOut - feesIn)}
        </span>
      </div>

      {hard.length > 0 && (
        <div className="panel">
          <h2>Blocking violations</h2>
          {hard.map((v, i) => (
            <div className="violation hard" key={i}>
              <span className="code">{v.code.replace(/_/g, ' ')}</span>
              {v.message}
            </div>
          ))}
        </div>
      )}

      {advisory.length > 0 && (
        <div className="panel">
          <h2>Advisory</h2>
          {advisory.map((v, i) => (
            <div className="violation advisory" key={i}>
              <span className="code">{v.code.replace(/_/g, ' ')}</span>
              {v.message}
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h2>
          Transfer plan <span className="count">{state.plan.length} moves</span>
        </h2>

        {state.plan.length === 0 && (
          <p className="hint">
            Nothing planned yet. Ask the agent for a signing, or add one from the market
            list yourself.
          </p>
        )}

        {state.plan.map((m) => {
          const p = playerById(m.playerId);
          return (
            <div className="move" key={m.id}>
              <span className={`kind ${m.kind === 'signing' ? 'in' : 'out'}`}>
                {m.kind === 'signing' ? 'in' : 'out'}
              </span>
              <span className="nm">
                {p?.name ?? m.playerId}
                {m.kind === 'signing' && (
                  <div className="meta" style={{ color: 'var(--faint)', fontSize: 11 }}>
                    {m.contractYears}-year deal · {fmtMoney(m.weeklyWage ?? 0)}/wk
                  </div>
                )}
              </span>
              <span className="fee">{fmtMoney(m.fee)}</span>
              <button onClick={() => store.removeMove(m.id, 'human')}>undo</button>
            </div>
          );
        })}

        {state.plan.length > 0 && (
          <>
            <div className="row" style={{ marginTop: 9 }}>
              <span className="k">Fees out</span>
              <span className="v neg">{fmtMoney(feesOut)}</span>
            </div>
            <div className="row">
              <span className="k">Fees in</span>
              <span className="v pos">{fmtMoney(feesIn)}</span>
            </div>
            <div className="row total">
              <span className="k">Net spend</span>
              <span className="v">{fmtMoney(feesOut - feesIn)}</span>
            </div>

            <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
              <button
                className="primary"
                disabled={!report.legal || state.submitted}
                onClick={() => store.requestSubmission()}
              >
                Submit window
              </button>
              <button onClick={() => store.clearPlan('human')}>Clear</button>
            </div>
            {!report.legal && (
              <p className="hint">
                Submission is blocked while the plan breaks a hard rule — for the agent
                and for you alike.
              </p>
            )}
          </>
        )}
      </div>

      <div className="panel">
        <h2>
          Activity <span className="count">who did what</span>
        </h2>
        {state.log.length === 0 && (
          <p className="hint">Every action is logged here, labelled by who took it.</p>
        )}
        <div className="log">
          {[...state.log].reverse().map((e) => (
            <div className={`log-entry${e.refused ? ' refused' : ''}`} key={e.id}>
              <span className={`who ${e.actor}`}>{e.actor}</span>
              <span className="txt">{e.text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
