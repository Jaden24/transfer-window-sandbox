/**
 * The WebMCP tool surface.
 *
 * Three tiers, one gate:
 *
 *   read-only    — ask the page anything. Free, safe, no state change.
 *   reversible   — change the plan. Every one of these is undoable.
 *   consequential— submit the window. The agent may *ask*; only a human click does it.
 *
 * The governing rule of this file: **the model never does the arithmetic.**
 * Every figure an agent is able to state about money or legality comes back
 * from `src/engine/rules.ts`. That is the whole point of putting the tools in
 * the page — the page owns the rulebook, so the agent cannot bluff a number,
 * and cannot talk its way past a limit.
 */

import { CLUBS } from '../data/clubs';
import { playerById } from '../data/players';
import {
  annualAmortisation,
  annualWage,
  bookValue,
  contractYearsRemaining,
  evaluateCompliance,
  fmtMoney,
  profitOnSale,
} from '../engine/rules';
import * as store from '../engine/store';
import type { ComplianceReport, PlannedMove, Player } from '../engine/types';
import { ok, refuse, type WebMcpTool } from './adapter';

const M = 1_000_000;

// ---------------------------------------------------------------------------
// Shaping
// ---------------------------------------------------------------------------

/** Money goes out twice: a number to reason with, a string to say out loud. */
const money = (n: number) => ({ gbp: n, display: fmtMoney(n) });

function playerSummary(p: Player) {
  return {
    player_id: p.id,
    name: p.name,
    position: p.position,
    age: p.age,
    club: p.clubId ?? 'free agent',
    homegrown: p.homegrown,
    academy_graduate: p.clubTrained,
    market_value: money(p.marketValue),
  };
}

function playerAccounting(p: Player) {
  return {
    ...playerSummary(p),
    contract_years_remaining: contractYearsRemaining(p),
    weekly_wage: money(p.weeklyWage),
    annual_wage: money(annualWage(p)),
    annual_amortisation: money(annualAmortisation(p)),
    book_value: money(bookValue(p)),
    note: p.clubTrained
      ? 'Academy graduate: book value is zero, so the entire sale fee is booked as profit.'
      : undefined,
  };
}

function complianceSummary(r: ComplianceReport) {
  return {
    legal: r.legal,
    psr: {
      three_year_aggregate: money(r.psr.aggregate),
      limit: money(r.psr.limit),
      headroom: money(r.psr.headroom),
      breach: r.psr.breach,
      breach_amount: r.psr.breach ? money(r.psr.breachAmount) : null,
    },
    squad: {
      senior: `${r.squad.seniorCount}/${r.squad.seniorLimit}`,
      non_homegrown: `${r.squad.nonHomegrownCount}/${r.squad.nonHomegrownLimit}`,
      u21_exempt: r.squad.u21Exempt,
      by_position: r.squad.byPosition,
    },
    violations: r.violations.map((v) => ({
      code: v.code, severity: v.severity, message: v.message,
    })),
  };
}

function requirePlayer(id: string): Player {
  const p = playerById(id);
  if (!p) throw new Error(`No player with id "${id}". Use search_players to find valid ids.`);
  return p;
}

// ---------------------------------------------------------------------------
// Tier 1 — read only
// ---------------------------------------------------------------------------

const getClubState: WebMcpTool = {
  name: 'get_club_state',
  description:
    'Financial and squad position of the club you are managing: three-year PSR ' +
    'aggregate, remaining headroom, current-season projection, and squad counts. ' +
    'Call this first — every spending decision depends on the headroom figure.',
  inputSchema: { type: 'object', properties: {} },
  execute: () => {
    const club = store.currentClub();
    const r = store.compliance();
    const cs = r.psr.currentSeason;
    return ok({
      club: { id: club.id, name: club.name },
      psr_window: {
        prior_seasons: r.psr.priorSeasons.map((s) => ({
          season: s.season, adjusted_profit: money(s.adjustedProfit),
        })),
        current_season_projection: {
          revenue: money(cs.revenue),
          player_wages: money(cs.wages),
          player_amortisation: money(cs.amortisation),
          profit_on_player_sales: money(cs.profitOnPlayerSales),
          other_operating_costs: money(cs.otherOperatingCosts),
          allowable_deductions: money(cs.allowableDeductions),
          adjusted_profit: money(cs.adjustedProfit),
        },
      },
      ...complianceSummary(r),
      planned_moves: store.getState().plan.length,
      other_clubs: CLUBS.filter((c) => c.id !== club.id).map((c) => ({ id: c.id, name: c.name })),
    });
  },
};

const listSquad: WebMcpTool = {
  name: 'list_squad',
  description:
    'The current squad with full accounting detail per player: wage, remaining ' +
    'contract, annual amortisation charge, and book value. Book value is what ' +
    'you must beat on a sale to book a profit.',
  inputSchema: {
    type: 'object',
    properties: {
      position: { type: 'string', enum: ['GK', 'DF', 'MF', 'FW'], description: 'Filter by position.' },
      academy_only: { type: 'boolean', description: 'Only academy graduates (book value zero).' },
    },
  },
  execute: ({ position, academy_only }: { position?: string; academy_only?: boolean }) => {
    let squad = store.squadOf(store.getState().clubId);
    if (position) squad = squad.filter((p) => p.position === position);
    if (academy_only) squad = squad.filter((p) => p.clubTrained);
    return ok({
      count: squad.length,
      players: squad.map(playerAccounting),
    });
  },
};

const searchPlayers: WebMcpTool = {
  name: 'search_players',
  description:
    'Search the transfer market for players at other clubs. Returns market value, ' +
    'which is the price you would be quoted. Filter before you reason — do not ask ' +
    'for the whole list and sort it yourself.',
  inputSchema: {
    type: 'object',
    properties: {
      position: { type: 'string', enum: ['GK', 'DF', 'MF', 'FW'] },
      max_value_millions: { type: 'number', description: 'Upper bound on market value, in £m.' },
      max_age: { type: 'number' },
      homegrown_only: {
        type: 'boolean',
        description: 'Only homegrown players — useful when the non-homegrown limit is tight.',
      },
      limit: { type: 'number', description: 'Max results. Defaults to 10.' },
    },
  },
  execute: (args: {
    position?: string; max_value_millions?: number; max_age?: number;
    homegrown_only?: boolean; limit?: number;
  }) => {
    let market = store.marketFor(store.getState().clubId);
    if (args.position) market = market.filter((p) => p.position === args.position);
    if (args.max_value_millions != null) {
      market = market.filter((p) => p.marketValue <= args.max_value_millions! * M);
    }
    if (args.max_age != null) market = market.filter((p) => p.age <= args.max_age!);
    if (args.homegrown_only) market = market.filter((p) => p.homegrown);
    market = [...market].sort((a, b) => b.marketValue - a.marketValue);
    const limit = Math.min(args.limit ?? 10, 40);
    return ok({
      matches: market.length,
      showing: Math.min(limit, market.length),
      players: market.slice(0, limit).map(playerSummary),
    });
  },
};

const getPlayer: WebMcpTool = {
  name: 'get_player',
  description:
    'Full detail on one player, including the accounting figures that decide what ' +
    'buying or selling them does to PSR.',
  inputSchema: {
    type: 'object',
    properties: { player_id: { type: 'string' } },
    required: ['player_id'],
  },
  execute: ({ player_id }: { player_id: string }) => ok(playerAccounting(requirePlayer(player_id))),
};

const computePsrPosition: WebMcpTool = {
  name: 'compute_psr_position',
  description:
    'The full PSR calculation for the plan as it currently stands, broken down ' +
    'line by line. Use this to explain *why* a club is where it is, rather than ' +
    'asserting figures.',
  inputSchema: { type: 'object', properties: {} },
  execute: () => {
    const r = store.compliance();
    const cs = r.psr.currentSeason;
    return ok({
      working: [
        `revenue ${fmtMoney(cs.revenue)}`,
        `less player wages ${fmtMoney(cs.wages)}`,
        `less player amortisation ${fmtMoney(cs.amortisation)}`,
        `less other operating costs ${fmtMoney(cs.otherOperatingCosts)}`,
        `plus profit on player sales ${fmtMoney(cs.profitOnPlayerSales)}`,
        `plus allowable deductions ${fmtMoney(cs.allowableDeductions)}`,
        `= current season ${fmtMoney(cs.adjustedProfit)}`,
        `prior seasons ${r.psr.priorSeasons.map((s) => fmtMoney(s.adjustedProfit)).join(' and ')}`,
        `= three-year aggregate ${fmtMoney(r.psr.aggregate)} against a ${fmtMoney(r.psr.limit)} limit`,
      ],
      ...complianceSummary(r),
    });
  },
};

const checkSquadCompliance: WebMcpTool = {
  name: 'check_squad_compliance',
  description:
    'Registration legality only: 25-man senior squad, maximum 17 non-homegrown, ' +
    'under-21s exempt. Returns every violation, hard and advisory.',
  inputSchema: { type: 'object', properties: {} },
  execute: () => ok(complianceSummary(store.compliance()).squad),
};

const evaluateTransfer: WebMcpTool = {
  name: 'evaluate_transfer',
  description:
    'What-if. Model a signing or a sale WITHOUT adding it to the plan, and get the ' +
    'exact effect on PSR and squad legality. Use this before proposing anything ' +
    'expensive so you can tell the manager the cost before they commit.',
  inputSchema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['signing', 'sale'] },
      player_id: { type: 'string' },
      fee_millions: { type: 'number', description: 'Fee in £m. Defaults to market value.' },
      contract_years: { type: 'number', description: 'Signings only. Defaults to 4.' },
      weekly_wage_gbp: { type: 'number', description: 'Signings only. Defaults to current wage.' },
    },
    required: ['kind', 'player_id'],
  },
  execute: (args: {
    kind: 'signing' | 'sale'; player_id: string;
    fee_millions?: number; contract_years?: number; weekly_wage_gbp?: number;
  }) => {
    const p = requirePlayer(args.player_id);
    const fee = (args.fee_millions ?? p.marketValue / M) * M;
    const move: PlannedMove = {
      id: 'what-if',
      kind: args.kind,
      playerId: p.id,
      fee,
      contractYears: args.contract_years ?? 4,
      weeklyWage: args.weekly_wage_gbp ?? p.weeklyWage,
    };
    const before = store.compliance();
    const after = store.complianceWith(move);
    const swing = after.psr.aggregate - before.psr.aggregate;

    return ok({
      move: {
        kind: args.kind, player: p.name, fee: money(fee),
        ...(args.kind === 'signing'
          ? {
              contract_years: move.contractYears,
              annual_amortisation: money(Math.round(fee / Math.min(move.contractYears!, 5))),
              annual_wage: money(Math.round((move.weeklyWage ?? 0) * 52)),
            }
          : {
              book_value: money(bookValue(p)),
              profit_on_sale: money(profitOnSale(p, fee)),
              wage_relief: money(annualWage(p)),
              amortisation_relief: money(annualAmortisation(p)),
            }),
      },
      psr_swing: money(swing),
      headroom_before: money(before.psr.headroom),
      headroom_after: money(after.psr.headroom),
      would_be_legal: after.legal,
      new_violations: after.violations
        .filter((v) => !before.violations.some((b) => b.code === v.code))
        .map((v) => ({ code: v.code, severity: v.severity, message: v.message })),
    });
  },
};

const rankSaleCandidates: WebMcpTool = {
  name: 'rank_sale_candidates',
  description:
    'Rank every squad player by how much selling them at market value would improve ' +
    'the PSR position. The answer is frequently counterintuitive: an expensive ' +
    'recent signing can help more than an academy graduate, because you shed their ' +
    'amortisation and wages as well as booking the fee. Do not guess this — ask.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'How many to return. Defaults to 8.' },
      exclude_position: {
        type: 'string', enum: ['GK', 'DF', 'MF', 'FW'],
        description: 'Protect a position you cannot afford to weaken.',
      },
    },
  },
  execute: ({ limit, exclude_position }: { limit?: number; exclude_position?: string }) => {
    const club = store.currentClub();
    const plan = store.getState().plan;
    const alreadySold = new Set(plan.filter((m) => m.kind === 'sale').map((m) => m.playerId));
    const before = store.compliance();

    let squad = store.squadOf(club.id).filter((p) => !alreadySold.has(p.id));
    if (exclude_position) squad = squad.filter((p) => p.position !== exclude_position);

    const ranked = squad.map((p) => {
      const move: PlannedMove = {
        id: 'what-if', kind: 'sale', playerId: p.id, fee: p.marketValue,
      };
      const after = evaluateCompliance(club, store.allPlayers(), [...plan, move]);
      return {
        player_id: p.id,
        name: p.name,
        position: p.position,
        age: p.age,
        academy_graduate: p.clubTrained,
        sale_price: money(p.marketValue),
        book_value: money(bookValue(p)),
        profit_on_sale: money(profitOnSale(p, p.marketValue)),
        wage_relief: money(annualWage(p)),
        amortisation_relief: money(annualAmortisation(p)),
        psr_improvement: money(after.psr.aggregate - before.psr.aggregate),
        _sort: after.psr.aggregate - before.psr.aggregate,
      };
    });

    ranked.sort((a, b) => b._sort - a._sort);
    const out = ranked.slice(0, Math.min(limit ?? 8, 25)).map(({ _sort, ...rest }) => rest);
    return ok({
      note: 'psr_improvement combines profit on sale, wage relief and amortisation relief.',
      current_headroom: money(before.psr.headroom),
      candidates: out,
    });
  },
};

// ---------------------------------------------------------------------------
// Tier 2 — reversible plan edits
// ---------------------------------------------------------------------------

const proposeSigning: WebMcpTool = {
  name: 'propose_signing',
  description:
    'Add a signing to the transfer plan. The page REFUSES the move if it would ' +
    'breach PSR or the squad-registration limits, and tells you by exactly how ' +
    'much. To stage a package deal — sign a star, fund it with a sale — pass ' +
    'allow_provisional: true, then balance the books before submitting.',
  inputSchema: {
    type: 'object',
    properties: {
      player_id: { type: 'string' },
      fee_millions: { type: 'number', description: 'Fee in £m. Defaults to market value.' },
      contract_years: {
        type: 'number',
        description: 'Contract length. Longer deals spread the fee, but amortisation caps at 5 years.',
      },
      weekly_wage_gbp: { type: 'number' },
      allow_provisional: {
        type: 'boolean',
        description: 'Add the move even if it currently breaches, so it can be balanced by a sale.',
      },
    },
    required: ['player_id'],
  },
  execute: (args: {
    player_id: string; fee_millions?: number; contract_years?: number;
    weekly_wage_gbp?: number; allow_provisional?: boolean;
  }) => {
    const p = requirePlayer(args.player_id);
    if (p.clubId === store.getState().clubId) {
      return refuse(`${p.name} already plays for you.`);
    }
    const fee = (args.fee_millions ?? p.marketValue / M) * M;
    const move: PlannedMove = {
      id: store.newMoveId(),
      kind: 'signing',
      playerId: p.id,
      fee,
      contractYears: args.contract_years ?? 4,
      weeklyWage: args.weekly_wage_gbp ?? p.weeklyWage,
    };

    const after = store.complianceWith(move);
    const hard = after.violations.filter((v) => v.severity === 'hard');

    if (hard.length > 0 && !args.allow_provisional) {
      store.log('agent', `tried to sign ${p.name} for ${fmtMoney(fee)} — refused`, true);
      return refuse(
        `Signing ${p.name} for ${fmtMoney(fee)} would break the rules.`,
        {
          violations: hard.map((v) => ({ code: v.code, message: v.message, over_by: v.overBy })),
          annual_amortisation: money(Math.round(fee / Math.min(move.contractYears!, 5))),
          annual_wage: money(Math.round((move.weeklyWage ?? 0) * 52)),
          headroom_now: money(store.compliance().psr.headroom),
          headroom_after: money(after.psr.headroom),
          hint:
            'Free up room first — call rank_sale_candidates to see which sale helps most — ' +
            'or retry with allow_provisional: true to stage this as part of a package.',
        },
      );
    }

    store.addMove(move, 'agent');
    return ok({
      added: true,
      provisional: hard.length > 0,
      move_id: move.id,
      signed: `${p.name} for ${fmtMoney(fee)} on a ${move.contractYears}-year deal`,
      annual_amortisation: money(Math.round(fee / Math.min(move.contractYears!, 5))),
      ...complianceSummary(after),
    });
  },
};

const proposeSale: WebMcpTool = {
  name: 'propose_sale',
  description:
    'Add a sale to the transfer plan. Sales are how you create PSR room: the profit ' +
    'is booked immediately, and you shed the wages and amortisation too.',
  inputSchema: {
    type: 'object',
    properties: {
      player_id: { type: 'string' },
      fee_millions: { type: 'number', description: 'Fee in £m. Defaults to market value.' },
    },
    required: ['player_id'],
  },
  execute: (args: { player_id: string; fee_millions?: number }) => {
    const p = requirePlayer(args.player_id);
    const state = store.getState();
    if (p.clubId !== state.clubId) {
      return refuse(`${p.name} does not play for you, so you cannot sell them.`);
    }
    if (state.plan.some((m) => m.kind === 'sale' && m.playerId === p.id)) {
      return refuse(`${p.name} is already in the plan to be sold.`);
    }
    const fee = (args.fee_millions ?? p.marketValue / M) * M;
    const move: PlannedMove = { id: store.newMoveId(), kind: 'sale', playerId: p.id, fee };

    store.addMove(move, 'agent');
    const after = store.compliance();
    return ok({
      added: true,
      move_id: move.id,
      sold: `${p.name} for ${fmtMoney(fee)}`,
      book_value: money(bookValue(p)),
      profit_on_sale: money(profitOnSale(p, fee)),
      ...complianceSummary(after),
    });
  },
};

const removeFromPlan: WebMcpTool = {
  name: 'remove_from_plan',
  description: 'Undo one planned move by its move_id. Everything in the plan is reversible.',
  inputSchema: {
    type: 'object',
    properties: { move_id: { type: 'string' } },
    required: ['move_id'],
  },
  execute: ({ move_id }: { move_id: string }) => {
    const removed = store.removeMove(move_id, 'agent');
    if (!removed) return refuse(`No planned move with id "${move_id}".`);
    return ok({ removed: true, ...complianceSummary(store.compliance()) });
  },
};

const getPlan: WebMcpTool = {
  name: 'get_plan',
  description: 'The transfer plan as it stands, with move ids, net spend, and current legality.',
  inputSchema: { type: 'object', properties: {} },
  execute: () => {
    const { plan, submitted, awaitingConfirmation } = store.getState();
    const feesOut = plan.filter((m) => m.kind === 'signing').reduce((n, m) => n + m.fee, 0);
    const feesIn = plan.filter((m) => m.kind === 'sale').reduce((n, m) => n + m.fee, 0);
    return ok({
      moves: plan.map((m) => ({
        move_id: m.id,
        kind: m.kind,
        player: playerById(m.playerId)?.name ?? m.playerId,
        fee: money(m.fee),
        ...(m.kind === 'signing'
          ? { contract_years: m.contractYears, weekly_wage: money(m.weeklyWage ?? 0) }
          : {}),
      })),
      fees_out: money(feesOut),
      fees_in: money(feesIn),
      net_spend: money(feesOut - feesIn),
      submitted,
      awaiting_human_confirmation: awaitingConfirmation,
      ...complianceSummary(store.compliance()),
    });
  },
};

const clearPlan: WebMcpTool = {
  name: 'clear_plan',
  description: 'Discard every planned move and start the window again.',
  inputSchema: { type: 'object', properties: {} },
  execute: () => {
    store.clearPlan('agent');
    return ok({ cleared: true, ...complianceSummary(store.compliance()) });
  },
};

// ---------------------------------------------------------------------------
// Tier 3 — consequential, human-gated
// ---------------------------------------------------------------------------

const submitWindow: WebMcpTool = {
  name: 'submit_window',
  description:
    'Ask for the transfer window to be submitted. This does NOT submit it. If the ' +
    'plan is illegal the page refuses outright. If it is legal, the page raises a ' +
    'confirmation in the UI and THIS CALL BLOCKS until a human presses a button — ' +
    'expect to wait. It resolves only when the manager confirms or declines. You ' +
    'can never complete this action on the manager’s behalf.',
  inputSchema: { type: 'object', properties: {} },
  execute: async (_args: unknown, ctx?: { signal?: AbortSignal }) => {
    const report = store.compliance();
    if (!report.legal) {
      const hard = report.violations.filter((v) => v.severity === 'hard');
      store.log('agent', 'asked to submit the window — refused, plan is illegal', true);
      return refuse('The plan is not compliant, so it cannot be submitted.', {
        violations: hard.map((v) => ({ code: v.code, message: v.message, over_by: v.overBy })),
      });
    }
    if (store.getState().plan.length === 0) {
      return refuse('There is nothing in the plan to submit.');
    }
    store.log('agent', 'requested submission — waiting on the manager');

    // Suspend here. The agent stays inside this tool call, blocked, until a
    // human presses a button in the page. Nothing it can do will resolve this.
    const outcome = await store.requestSubmissionAndWait(ctx?.signal);

    if (outcome === 'confirmed') {
      return ok({
        submitted: true,
        confirmed_by: 'human',
        message: 'The manager pressed "Confirm & submit". The window is registered.',
        ...complianceSummary(store.compliance()),
      });
    }

    if (outcome === 'aborted') {
      return refuse('The submission request was cancelled before the manager answered.');
    }

    if (outcome === 'timed_out') {
      return refuse('The confirmation went unanswered and the request expired.', {
        hint: 'Ask the manager whether they still want this window submitted, then try again.',
      });
    }

    return refuse('The manager declined to submit the window.', {
      hint: 'The plan is untouched and still reversible. Ask what they would like changed.',
    });
  },
};

// ---------------------------------------------------------------------------

const RAW_TOOLS: WebMcpTool[] = [
  // read-only
  getClubState,
  listSquad,
  searchPlayers,
  getPlayer,
  computePsrPosition,
  checkSquadCompliance,
  evaluateTransfer,
  rankSaleCandidates,
  getPlan,
  // reversible
  proposeSigning,
  proposeSale,
  removeFromPlan,
  clearPlan,
  // consequential
  submitWindow,
];

/**
 * Behaviour hints per tier. Derived from the tier rather than hand-written per
 * tool, so the annotation an agent reads can never drift from the tier the UI
 * displays.
 */
const TIER_ANNOTATIONS = {
  read: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  reversible: {
    readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false,
  },
  gated: {
    readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false,
  },
} as const;

export const TOOL_TIERS: Record<string, 'read' | 'reversible' | 'gated'> = {
  get_club_state: 'read',
  list_squad: 'read',
  search_players: 'read',
  get_player: 'read',
  compute_psr_position: 'read',
  check_squad_compliance: 'read',
  evaluate_transfer: 'read',
  rank_sale_candidates: 'read',
  get_plan: 'read',
  propose_signing: 'reversible',
  propose_sale: 'reversible',
  remove_from_plan: 'reversible',
  clear_plan: 'reversible',
  submit_window: 'gated',
};

/**
 * `clear_plan` discards work rather than adding to it, so it is flagged
 * destructive even though it sits in the reversible tier — a client may
 * reasonably want to confirm it.
 *
 * No tool here returns user-generated or externally fetched content, so none
 * carries `untrustedContentHint`. Everything comes from the page's own data and
 * its own rules engine.
 */
export const TOOLS: WebMcpTool[] = RAW_TOOLS.map((tool) => ({
  ...tool,
  annotations: {
    ...TIER_ANNOTATIONS[TOOL_TIERS[tool.name] ?? 'read'],
    ...(tool.name === 'clear_plan' ? { destructiveHint: true } : {}),
  },
}));
