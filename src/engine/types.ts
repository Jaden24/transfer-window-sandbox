/**
 * Domain types for the Transfer Window Sandbox.
 *
 * All money is stored as whole pounds (GBP) in `number`. Football finance
 * numbers fit comfortably inside Number.MAX_SAFE_INTEGER, and keeping a single
 * unit everywhere avoids the classic "was that millions or pounds?" bug class.
 */

export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  id: string;
  name: string;
  position: Position;
  age: number;
  /** Club that currently holds the registration. `null` = free agent. */
  clubId: string | null;
  /**
   * Homegrown for Premier League registration purposes: registered with any
   * English or Welsh club for 3 seasons before their 21st birthday.
   */
  homegrown: boolean;
  /**
   * Trained by *this* club's own academy. Matters for accounting, not
   * registration: an academy graduate carries a book value of zero, so their
   * entire sale fee lands as pure profit. This is the single most exploited
   * lever in PSR planning.
   */
  clubTrained: boolean;

  /** Original transfer fee paid for this player. Zero for academy graduates. */
  signedFee: number;
  /** Contract length in years at the moment of signing. */
  contractLengthAtSigning: number;
  /** Whole years already served on that contract. */
  yearsElapsed: number;
  /** Gross weekly wage. */
  weeklyWage: number;

  /** Illustrative market valuation, used to price the transfer market. */
  marketValue: number;
}

export interface PriorSeason {
  season: string;
  /** Adjusted profit/loss for PSR purposes. Negative = loss. */
  adjustedProfit: number;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  /** The two completed seasons in the rolling three-year PSR window. */
  psrPriorSeasons: PriorSeason[];
  /** Projected turnover for the current season. */
  projectedRevenue: number;
  /**
   * Everything that isn't first-team playing wages or player amortisation:
   * non-playing staff, matchday and stadium costs, admin, depreciation, and the
   * wages of squad members outside the modelled first team.
   */
  nonWageOperatingCosts: number;
  /**
   * Spending the rules let you add back before testing against the limit:
   * academy, women's football, infrastructure, community.
   */
  allowableDeductions: number;
}

export type MoveKind = 'signing' | 'sale';

export interface PlannedMove {
  id: string;
  kind: MoveKind;
  playerId: string;
  /** Fee paid (signing) or received (sale). */
  fee: number;
  /** Signings only: length of the contract offered, in years. */
  contractYears?: number;
  /** Signings only: gross weekly wage offered. */
  weeklyWage?: number;
}

export type ViolationCode =
  | 'PSR_BREACH'
  | 'SQUAD_SIZE'
  | 'NON_HOMEGROWN_LIMIT'
  | 'SQUAD_SHAPE';

export interface Violation {
  code: ViolationCode;
  /** `hard` blocks submission. `advisory` is a warning the human may ignore. */
  severity: 'hard' | 'advisory';
  message: string;
  /** How far over the line, in pounds or headcount, where meaningful. */
  overBy?: number;
}

export interface CurrentSeasonPnL {
  revenue: number;
  wages: number;
  amortisation: number;
  profitOnPlayerSales: number;
  otherOperatingCosts: number;
  allowableDeductions: number;
  /** Bottom line after add-backs. Negative = loss. */
  adjustedProfit: number;
}

export interface PsrPosition {
  priorSeasons: PriorSeason[];
  currentSeason: CurrentSeasonPnL;
  /** Three-year aggregate. Negative = cumulative loss. */
  aggregate: number;
  /** The permitted floor, as a signed number (-105,000,000). */
  limit: number;
  /** Positive = room to spare. Negative = you are over. */
  headroom: number;
  breach: boolean;
  /** Positive amount by which the club exceeds the limit. Zero if compliant. */
  breachAmount: number;
}

export interface SquadPosition {
  seniorCount: number;
  seniorLimit: number;
  nonHomegrownCount: number;
  nonHomegrownLimit: number;
  u21Exempt: number;
  byPosition: Record<Position, number>;
}

export interface ComplianceReport {
  clubId: string;
  psr: PsrPosition;
  squad: SquadPosition;
  violations: Violation[];
  /** True only when there are no `hard` violations. */
  legal: boolean;
}
