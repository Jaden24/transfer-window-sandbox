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

/**
 * The agent can ask for the window to be submitted. It cannot submit it.
 * This flips a flag; only `confirmSubmission` — wired to a button the human
 * has to press — actually completes it.
 */
export function requestSubmission() {
  set({ awaitingConfirmation: true });
}

export function confirmSubmission() {
  set({ awaitingConfirmation: false, submitted: true });
  log('human', 'confirmed and submitted the transfer window');
}

export function cancelSubmission() {
  set({ awaitingConfirmation: false });
  log('human', 'declined to submit the window');
}

export function resetAll() {
  set({ plan: [], log: [], awaitingConfirmation: false, submitted: false });
}
