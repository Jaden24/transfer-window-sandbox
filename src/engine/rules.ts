/**
 * The rulebook.
 *
 * Every number the agent is allowed to say about money or squad legality comes
 * out of this file. The tools in `src/webmcp/tools.ts` are thin wrappers over
 * these functions — the model never does the arithmetic itself, because this is
 * exactly the arithmetic language models get confidently wrong.
 *
 * Rules modelled (all real, all public):
 *
 *  - PSR: a club may lose at most £105m in aggregate across a rolling
 *    three-season window, after permitted add-backs.
 *  - Transfer fees are capitalised and amortised evenly across the contract,
 *    capped at five years. A £100m signing on a six-year deal is a £20m annual
 *    charge, not a £100m one.
 *  - Selling a player books the profit *immediately*: fee minus the unamortised
 *    residual. Academy graduates carry a book value of zero, so their whole fee
 *    is pure profit. This is why clubs sell their own kids in June.
 *  - Squad registration: 25 senior players, of whom at most 17 may be
 *    non-homegrown. Under-21s do not occupy a place.
 *
 * Deliberate simplifications, so nobody mistakes this for an audit tool:
 *  - A signing is charged a full season of amortisation and wages rather than
 *    being pro-rated from the transfer date. This is the conservative direction.
 *  - Prior seasons arrive pre-adjusted; we do not re-derive them.
 *  - Agent fees, signing-on bonuses, sell-on clauses and add-ons are ignored.
 */

import type {
  Club,
  ComplianceReport,
  CurrentSeasonPnL,
  PlannedMove,
  Player,
  Position,
  PsrPosition,
  SquadPosition,
  Violation,
} from './types';

/** Aggregate three-year loss permitted by PSR, as a signed number. */
export const PSR_LIMIT = -105_000_000;
export const SENIOR_SQUAD_LIMIT = 25;
export const NON_HOMEGROWN_LIMIT = 17;
/** Players at or below this age do not occupy a senior squad place. */
export const U21_MAX_AGE = 21;
/** Fees may not be amortised over more than five years, however long the deal. */
export const MAX_AMORTISATION_YEARS = 5;

const WEEKS_PER_YEAR = 52;

// ---------------------------------------------------------------------------
// Per-player accounting
// ---------------------------------------------------------------------------

export function contractYearsRemaining(p: Player): number {
  return Math.max(0, p.contractLengthAtSigning - p.yearsElapsed);
}

/**
 * Unamortised residual still sitting on the balance sheet. Selling above this
 * number books a profit; selling below it books a loss.
 */
export function bookValue(p: Player): number {
  if (p.clubTrained || p.signedFee <= 0) return 0;
  const span = Math.min(p.contractLengthAtSigning, MAX_AMORTISATION_YEARS);
  if (span <= 0) return 0;
  const remaining = Math.min(contractYearsRemaining(p), span);
  return Math.round((p.signedFee * remaining) / span);
}

/** Annual amortisation charge while the contract still has time to run. */
export function annualAmortisation(p: Player): number {
  if (p.clubTrained || p.signedFee <= 0) return 0;
  if (contractYearsRemaining(p) <= 0) return 0;
  const span = Math.min(p.contractLengthAtSigning, MAX_AMORTISATION_YEARS);
  return Math.round(p.signedFee / span);
}

export function annualWage(p: Player): number {
  return Math.round(p.weeklyWage * WEEKS_PER_YEAR);
}

/** Fee received minus what the player was still worth on the books. */
export function profitOnSale(p: Player, fee: number): number {
  return fee - bookValue(p);
}

// ---------------------------------------------------------------------------
// Applying a plan
// ---------------------------------------------------------------------------

/**
 * Turn a signing into the Player record it would become at the buying club:
 * a fresh contract, our wage bill, and — crucially — not our academy product.
 */
export function asSignedPlayer(p: Player, move: PlannedMove, clubId: string): Player {
  return {
    ...p,
    clubId,
    clubTrained: false,
    signedFee: move.fee,
    contractLengthAtSigning: move.contractYears ?? 4,
    yearsElapsed: 0,
    weeklyWage: move.weeklyWage ?? p.weeklyWage,
  };
}

export interface ResolvedPlan {
  /** The squad as it would stand once the window shuts. */
  squad: Player[];
  sales: { player: Player; fee: number; profit: number }[];
  signings: { player: Player; fee: number }[];
  totalFeesOut: number;
  totalFeesIn: number;
}

export function resolvePlan(
  club: Club,
  allPlayers: Player[],
  plan: PlannedMove[],
): ResolvedPlan {
  const byId = new Map(allPlayers.map((p) => [p.id, p]));
  const soldIds = new Set(
    plan.filter((m) => m.kind === 'sale').map((m) => m.playerId),
  );

  const retained = allPlayers.filter(
    (p) => p.clubId === club.id && !soldIds.has(p.id),
  );

  const signings: ResolvedPlan['signings'] = [];
  const incoming: Player[] = [];
  for (const move of plan) {
    if (move.kind !== 'signing') continue;
    const base = byId.get(move.playerId);
    if (!base) continue;
    const signed = asSignedPlayer(base, move, club.id);
    incoming.push(signed);
    signings.push({ player: signed, fee: move.fee });
  }

  const sales: ResolvedPlan['sales'] = [];
  for (const move of plan) {
    if (move.kind !== 'sale') continue;
    const base = byId.get(move.playerId);
    if (!base) continue;
    sales.push({ player: base, fee: move.fee, profit: profitOnSale(base, move.fee) });
  }

  return {
    squad: [...retained, ...incoming],
    sales,
    signings,
    totalFeesOut: signings.reduce((n, s) => n + s.fee, 0),
    totalFeesIn: sales.reduce((n, s) => n + s.fee, 0),
  };
}

// ---------------------------------------------------------------------------
// PSR
// ---------------------------------------------------------------------------

export function projectSeason(
  club: Club,
  allPlayers: Player[],
  plan: PlannedMove[],
): CurrentSeasonPnL {
  const resolved = resolvePlan(club, allPlayers, plan);

  const wages = resolved.squad.reduce((n, p) => n + annualWage(p), 0);
  const amortisation = resolved.squad.reduce((n, p) => n + annualAmortisation(p), 0);
  const profitOnPlayerSales = resolved.sales.reduce((n, s) => n + s.profit, 0);

  const adjustedProfit =
    club.projectedRevenue -
    wages -
    amortisation -
    club.nonWageOperatingCosts +
    profitOnPlayerSales +
    club.allowableDeductions;

  return {
    revenue: club.projectedRevenue,
    wages,
    amortisation,
    profitOnPlayerSales,
    otherOperatingCosts: club.nonWageOperatingCosts,
    allowableDeductions: club.allowableDeductions,
    adjustedProfit,
  };
}

export function computePsr(
  club: Club,
  allPlayers: Player[],
  plan: PlannedMove[],
): PsrPosition {
  const currentSeason = projectSeason(club, allPlayers, plan);
  const priorTotal = club.psrPriorSeasons.reduce((n, s) => n + s.adjustedProfit, 0);
  const aggregate = priorTotal + currentSeason.adjustedProfit;
  const headroom = aggregate - PSR_LIMIT;

  return {
    priorSeasons: club.psrPriorSeasons,
    currentSeason,
    aggregate,
    limit: PSR_LIMIT,
    headroom,
    breach: headroom < 0,
    breachAmount: headroom < 0 ? -headroom : 0,
  };
}

// ---------------------------------------------------------------------------
// Squad registration
// ---------------------------------------------------------------------------

export function computeSquad(
  club: Club,
  allPlayers: Player[],
  plan: PlannedMove[],
): SquadPosition {
  const { squad } = resolvePlan(club, allPlayers, plan);
  const senior = squad.filter((p) => p.age > U21_MAX_AGE);

  const byPosition: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const p of squad) byPosition[p.position] += 1;

  return {
    seniorCount: senior.length,
    seniorLimit: SENIOR_SQUAD_LIMIT,
    nonHomegrownCount: senior.filter((p) => !p.homegrown).length,
    nonHomegrownLimit: NON_HOMEGROWN_LIMIT,
    u21Exempt: squad.length - senior.length,
    byPosition,
  };
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

/** Minimum bodies per position before we start warning about squad shape. */
const SHAPE_MINIMUMS: Record<Position, number> = { GK: 2, DF: 6, MF: 5, FW: 3 };

export function evaluateCompliance(
  club: Club,
  allPlayers: Player[],
  plan: PlannedMove[],
): ComplianceReport {
  const psr = computePsr(club, allPlayers, plan);
  const squad = computeSquad(club, allPlayers, plan);
  const violations: Violation[] = [];

  if (psr.breach) {
    violations.push({
      code: 'PSR_BREACH',
      severity: 'hard',
      overBy: psr.breachAmount,
      message:
        `PSR breach. Three-year aggregate is ${fmtMoney(psr.aggregate)} against a ` +
        `${fmtMoney(psr.limit)} limit — over by ${fmtMoney(psr.breachAmount)}.`,
    });
  }

  if (squad.seniorCount > squad.seniorLimit) {
    const over = squad.seniorCount - squad.seniorLimit;
    violations.push({
      code: 'SQUAD_SIZE',
      severity: 'hard',
      overBy: over,
      message:
        `Senior squad holds ${squad.seniorCount} players against a limit of ` +
        `${squad.seniorLimit} — ${over} too many. Under-21s do not count.`,
    });
  }

  if (squad.nonHomegrownCount > squad.nonHomegrownLimit) {
    const over = squad.nonHomegrownCount - squad.nonHomegrownLimit;
    violations.push({
      code: 'NON_HOMEGROWN_LIMIT',
      severity: 'hard',
      overBy: over,
      message:
        `${squad.nonHomegrownCount} non-homegrown players registered against a limit ` +
        `of ${squad.nonHomegrownLimit} — ${over} too many. Sign or promote a ` +
        `homegrown player, or sell a non-homegrown one.`,
    });
  }

  for (const [pos, min] of Object.entries(SHAPE_MINIMUMS) as [Position, number][]) {
    if (squad.byPosition[pos] < min) {
      violations.push({
        code: 'SQUAD_SHAPE',
        severity: 'advisory',
        overBy: min - squad.byPosition[pos],
        message:
          `Only ${squad.byPosition[pos]} ${pos} in the squad; ${min} is the practical ` +
          `minimum for a league season. Not a rule breach, but you cannot field this.`,
      });
    }
  }

  return {
    clubId: club.id,
    psr,
    squad,
    violations,
    legal: !violations.some((v) => v.severity === 'hard'),
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Renders pounds the way football people actually write them: £41.2m, £480k. */
export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}£${m >= 100 ? Math.round(m) : m.toFixed(1)}m`;
  }
  if (abs >= 1_000) return `${sign}£${Math.round(abs / 1_000)}k`;
  return `${sign}£${abs}`;
}
