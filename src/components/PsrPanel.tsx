import { PSR_LIMIT } from '../engine/rules';
import { useMoney } from '../engine/money';
import type { ComplianceReport } from '../engine/types';

function Row({ k, v, tone, total }: {
  k: string; v: number; tone?: 'neg' | 'pos'; total?: boolean;
}) {
  const money = useMoney();
  return (
    <div className={`row${total ? ' total' : ''}`}>
      <span className="k">{k}</span>
      <span className={`v ${tone ?? (v < 0 ? 'neg' : '')}`}>{money.fmt(v)}</span>
    </div>
  );
}

export default function PsrPanel({ report }: { report: ComplianceReport }) {
  const money = useMoney();
  const { psr, squad } = report;
  const cs = psr.currentSeason;

  // The gauge shows how much of the £105m allowance has been consumed.
  const consumed = Math.min(Math.max(-psr.aggregate, 0), -PSR_LIMIT);
  const pct = psr.breach ? 100 : (consumed / -PSR_LIMIT) * 100;

  return (
    <>
      <div className="panel">
        <h2>PSR headroom</h2>
        <div className={`headroom-value ${psr.breach ? 'bad' : 'ok'}`}>
          {psr.breach ? `−${money.fmt(psr.breachAmount)}` : money.fmt(psr.headroom)}
        </div>
        <div className="headroom-label">
          {psr.breach
            ? 'over the three-year limit — this plan cannot be submitted'
            : 'left to spend before breaching the £105m limit'}
        </div>

        <div className="gauge">
          <div
            className={`fill ${psr.breach ? 'bad' : 'ok'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="gauge-ends">
          <span>aggregate {money.fmt(psr.aggregate)}</span>
          <span>limit {money.fmt(psr.limit)}</span>
        </div>
      </div>

      <div className="panel">
        <h2>Squad registration</h2>
        <div className="counters">
          <div className="counter">
            <div className={`n ${squad.seniorCount > squad.seniorLimit ? 'bad' : ''}`}>
              {squad.seniorCount}<span style={{ color: 'var(--faint)', fontSize: 13 }}>/{squad.seniorLimit}</span>
            </div>
            <div className="l">senior squad</div>
          </div>
          <div className="counter">
            <div className={`n ${squad.nonHomegrownCount > squad.nonHomegrownLimit ? 'bad' : ''}`}>
              {squad.nonHomegrownCount}<span style={{ color: 'var(--faint)', fontSize: 13 }}>/{squad.nonHomegrownLimit}</span>
            </div>
            <div className="l">non-homegrown</div>
          </div>
          <div className="counter">
            <div className="n">{squad.u21Exempt}</div>
            <div className="l">U21 exempt</div>
          </div>
        </div>
        <p className="hint">
          Under-21s do not occupy a senior place. Of the 25 registered seniors, at most
          17 may be non-homegrown.
        </p>
      </div>

      <div className="panel">
        <h2>Current season projection</h2>
        <Row k="Revenue" v={cs.revenue} tone="pos" />
        <Row k="Player wages" v={-cs.wages} />
        <Row k="Player amortisation" v={-cs.amortisation} />
        <Row k="Other operating costs" v={-cs.otherOperatingCosts} />
        <Row k="Profit on player sales" v={cs.profitOnPlayerSales} tone={cs.profitOnPlayerSales > 0 ? 'pos' : undefined} />
        <Row k="Allowable deductions" v={cs.allowableDeductions} tone="pos" />
        <Row k="Adjusted result" v={cs.adjustedProfit} total />
      </div>

      <div className="panel">
        <h2>Three-year window</h2>
        {psr.priorSeasons.map((s) => (
          <Row key={s.season} k={s.season} v={s.adjustedProfit} />
        ))}
        <Row k="2025/26 (projected)" v={cs.adjustedProfit} />
        <Row k="Aggregate" v={psr.aggregate} total />
        <p className="hint">
          Fees are capitalised and amortised across the contract, capped at five years —
          a £100m signing is a £20m annual charge, not a £100m one. Sale profits land
          immediately, which is why clubs sell before the accounting deadline.
        </p>
      </div>
    </>
  );
}
