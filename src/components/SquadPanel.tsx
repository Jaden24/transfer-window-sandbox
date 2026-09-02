import { useMemo, useState } from 'react';
import { annualAmortisation, bookValue, fmtMoney } from '../engine/rules';
import * as store from '../engine/store';
import type { AppState } from '../engine/store';
import type { Player, Position } from '../engine/types';

const POSITIONS: (Position | 'ALL')[] = ['ALL', 'GK', 'DF', 'MF', 'FW'];

function PlayerRow({ p, right }: { p: Player; right: React.ReactNode }) {
  return (
    <div className="p">
      <span className="pos">{p.position}</span>
      <span className="nm">
        {p.name}
        {p.homegrown && <span className="tag hg">HG</span>}
        {p.clubTrained && <span className="tag ac">academy</span>}
        <div className="meta">
          {p.age}y · {fmtMoney(p.weeklyWage)}/wk
          {annualAmortisation(p) > 0 && ` · amort ${fmtMoney(annualAmortisation(p))}/yr`}
          {p.clubId && ` · book ${fmtMoney(bookValue(p))}`}
        </div>
      </span>
      <span className="val">{fmtMoney(p.marketValue)}</span>
      {right}
    </div>
  );
}

export default function SquadPanel({ state }: { state: AppState }) {
  const [tab, setTab] = useState<'squad' | 'market'>('squad');
  const [pos, setPos] = useState<Position | 'ALL'>('ALL');
  const [q, setQ] = useState('');

  const soldIds = useMemo(
    () => new Set(state.plan.filter((m) => m.kind === 'sale').map((m) => m.playerId)),
    [state.plan],
  );
  const signedIds = useMemo(
    () => new Set(state.plan.filter((m) => m.kind === 'signing').map((m) => m.playerId)),
    [state.plan],
  );

  const source = tab === 'squad'
    ? store.squadOf(state.clubId)
    : store.marketFor(state.clubId);

  const list = source
    .filter((p) => (pos === 'ALL' ? true : p.position === pos))
    .filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => b.marketValue - a.marketValue);

  return (
    <div className="panel">
      <h2>
        <button
          onClick={() => setTab('squad')}
          style={{ padding: '3px 9px', fontSize: 11, opacity: tab === 'squad' ? 1 : 0.55 }}
        >
          Squad
        </button>
        <button
          onClick={() => setTab('market')}
          style={{ padding: '3px 9px', fontSize: 11, opacity: tab === 'market' ? 1 : 0.55 }}
        >
          Transfer market
        </button>
        <span className="count">{list.length} players</span>
      </h2>

      <div className="searchbar">
        <select value={pos} onChange={(e) => setPos(e.target.value as Position | 'ALL')}>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>{p === 'ALL' ? 'All positions' : p}</option>
          ))}
        </select>
        <input
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="plist">
        {list.map((p) => {
          const planned = tab === 'squad' ? soldIds.has(p.id) : signedIds.has(p.id);
          return (
            <PlayerRow
              key={p.id}
              p={p}
              right={
                <button
                  disabled={planned}
                  onClick={() => {
                    if (tab === 'squad') {
                      store.addMove(
                        { id: store.newMoveId(), kind: 'sale', playerId: p.id, fee: p.marketValue },
                        'human',
                      );
                    } else {
                      store.addMove(
                        {
                          id: store.newMoveId(), kind: 'signing', playerId: p.id,
                          fee: p.marketValue, contractYears: 4, weeklyWage: p.weeklyWage,
                        },
                        'human',
                      );
                    }
                  }}
                >
                  {planned ? 'in plan' : tab === 'squad' ? 'Sell' : 'Sign'}
                </button>
              }
            />
          );
        })}
        {list.length === 0 && <p className="hint">Nobody matches that filter.</p>}
      </div>

      <p className="hint">
        You can move players yourself, or ask the agent to. Both go through the same
        tools, so the board stays in sync either way — and the page checks every move
        against the rules regardless of who made it.
      </p>
    </div>
  );
}
