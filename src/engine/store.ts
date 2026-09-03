/**
 * Application state, shared by the UI and the WebMCP tools.
 *
 * There is deliberately one store and one code path. When the agent calls
 * `propose_signing` it goes through exactly the same mutation the human's
 * click goes through, so the two can never drift apart — the human watches the
 * board change under the agent's hands, and either can undo the other.
 */

import { CLUBS, DEFAULT_CLUB_ID, clubById } from '../data/clubs';
import { PLAYERS, playerById } from '../data/players';
import { evaluateCompliance } from './rules';
import type { Club, ComplianceReport, PlannedMove, Player } from './types';

export type Actor = 'human' | 'agent';

export interface LogEntry {
  id: string;
  at: number;
  actor: Actor;
  /** Short past-tense description, e.g. "signed Victor Osimhen for £110m". */
  text: string;
  /** Set when the page refused the action. */
  refused?: boolean;
}

export interface AppState {
  clubId: string;
  plan: PlannedMove[];
  log: LogEntry[];
  /** Set by `submit_window`; cleared when the human confirms or cancels. */
  awaitingConfirmation: boolean;
  submitted: boolean;
}

let state: AppState = {
  clubId: DEFAULT_CLUB_ID,
  plan: [],
  log: [],
  awaitingConfirmation: false,
  submitted: false,
};

type Listener = (s: AppState) => void;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function set(next: Partial<AppState>) {
  state = { ...state, ...next };
  for (const fn of listeners) fn(state);
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${seq++}`;

export function log(actor: Actor, text: string, refused = false) {
  set({
    log: [...state.log, { id: nextId('log'), at: Date.now(), actor, text, refused }],
  });
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function currentClub(): Club {
  return clubById(state.clubId) ?? CLUBS[0];
}

export function allPlayers(): Player[] {
  return PLAYERS;
}

export function squadOf(clubId: string): Player[] {
  return PLAYERS.filter((p) => p.clubId === clubId);
}

/** Players who can be bought: anyone not already at the selected club. */
export function marketFor(clubId: string): Player[] {
  return PLAYERS.filter((p) => p.clubId !== clubId);
}

export function compliance(plan: PlannedMove[] = state.plan): ComplianceReport {
  return evaluateCompliance(currentClub(), PLAYERS, plan);
}

/** What the plan would look like with one more move applied. */
export function complianceWith(move: PlannedMove): ComplianceReport {
  return evaluateCompliance(currentClub(), PLAYERS, [...state.plan, move]);
}

// ---------------------------------------------------------------------------
// Mutations — the only way state changes, for human and agent alike
// ---------------------------------------------------------------------------

export function selectClub(clubId: string, actor: Actor = 'human') {
  const club = clubById(clubId);
  if (!club) throw new Error(`Unknown club: ${clubId}`);
  set({ clubId, plan: [], awaitingConfirmation: false, submitted: false });
  log(actor, `switched to ${club.name} and cleared the plan`);
}

export function addMove(move: PlannedMove, actor: Actor): PlannedMove {
  set({ plan: [...state.plan, move], submitted: false, awaitingConfirmation: false });
  const p = playerById(move.playerId);
  const verb = move.kind === 'signing' ? 'added a signing:' : 'added a sale:';
  log(actor, `${verb} ${p?.name ?? move.playerId}`);
  return move;
}

export function removeMove(moveId: string, actor: Actor): PlannedMove | null {
  const move = state.plan.find((m) => m.id === moveId) ?? null;
  if (!move) return null;
  set({
    plan: state.plan.filter((m) => m.id !== moveId),
    submitted: false,
    awaitingConfirmation: false,
  });
  const p = playerById(move.playerId);
  log(actor, `removed ${p?.name ?? move.playerId} from the plan`);
  return move;
}

export function clearPlan(actor: Actor) {
  set({ plan: [], submitted: false, awaitingConfirmation: false });
  log(actor, 'cleared the transfer plan');
}

export function newMoveId(): string {
  return nextId('mv');
}

// --- the human gate --------------------------------------------------------

export type SubmissionOutcome = 'confirmed' | 'declined' | 'timed_out' | 'aborted';

/** Resolver for an agent currently suspended inside `submit_window`. */
let pendingGate: ((outcome: SubmissionOutcome) => void) | null = null;
let gateTimer: ReturnType<typeof setTimeout> | null = null;

/** How long an agent may sit blocked before we let it go. */
const GATE_TIMEOUT_MS = 5 * 60 * 1000;

function settleGate(outcome: SubmissionOutcome) {
  if (gateTimer) { clearTimeout(gateTimer); gateTimer = null; }
  const resolve = pendingGate;
  pendingGate = null;
  resolve?.(outcome);
}

/** The human pressing "Submit window" in the UI. Raises the gate, waits for nobody. */
export function requestSubmission() {
  set({ awaitingConfirmation: true });
}

/**
 * The agent asking to submit.
 *
 * This deliberately does NOT resolve when called. It raises the confirmation in
 * the page and then suspends — the agent is genuinely blocked, mid-tool-call,
 * until a human presses a button. That is the Chrome-documented human-in-the-loop
 * pattern: the tool pauses execution and waits for user interaction before
 * completing a consequential action.
 */
export function requestSubmissionAndWait(signal?: AbortSignal): Promise<SubmissionOutcome> {
  settleGate('declined'); // supersede any earlier pending request
  set({ awaitingConfirmation: true });
  return new Promise<SubmissionOutcome>((resolve) => {
    pendingGate = resolve;
    gateTimer = setTimeout(() => {
      set({ awaitingConfirmation: false });
      log('human', 'left the confirmation unanswered — the request expired');
      settleGate('timed_out');
    }, GATE_TIMEOUT_MS);

    // If the agent's call is cancelled while we are waiting, drop the
    // confirmation rather than leaving a stale prompt on the page.
    signal?.addEventListener('abort', () => {
      if (!pendingGate) return;
      set({ awaitingConfirmation: false });
      log('agent', 'cancelled the submission request');
      settleGate('aborted');
    }, { once: true });
  });
}

export function confirmSubmission() {
  set({ awaitingConfirmation: false, submitted: true });
  log('human', 'confirmed and submitted the transfer window');
  settleGate('confirmed');
}

export function cancelSubmission() {
  set({ awaitingConfirmation: false });
  log('human', 'declined to submit the window');
  settleGate('declined');
}

export function resetAll() {
  set({ plan: [], log: [], awaitingConfirmation: false, submitted: false });
}
