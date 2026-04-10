import { writable, derived, get } from 'svelte/store';
import type { GamePhase, BetPercent, RoundRecord, SpinOutcome } from '$lib/types';

export const phase = writable<GamePhase>('input');
export const handle = writable<string>('');
export const followers = writable<number>(0);
export const startingFollowers = writable<number>(0);
export const betPct = writable<BetPercent>(10);
export const isSpinning = writable<boolean>(false);
export const roundHistory = writable<RoundRecord[]>([]);
export const lastOutcome = writable<SpinOutcome | null>(null);
export const isGameOver = writable<boolean>(false);

export const totalRounds = derived(roundHistory, ($history) => $history.length);

export function startGame(userHandle: string, followerCount: number): void {
  handle.set(userHandle);
  followers.set(followerCount);
  startingFollowers.set(followerCount);
  roundHistory.set([]);
  lastOutcome.set(null);
  isGameOver.set(false);
  phase.set('playing');
}

export function recordSpin(outcome: SpinOutcome): void {
  const currentBet = get(betPct);
  const currentRounds = get(roundHistory);

  const record: RoundRecord = {
    round: currentRounds.length + 1,
    outcome: outcome.type,
    betPct: currentBet,
    delta: outcome.followerDelta,
    total: outcome.newTotal
  };

  followers.set(outcome.newTotal);
  lastOutcome.set(outcome);
  roundHistory.update((h) => [...h, record]);

  if (outcome.newTotal <= 0) {
    isGameOver.set(true);
  }
}

export function resetGame(): void {
  phase.set('input');
  handle.set('');
  followers.set(0);
  startingFollowers.set(0);
  betPct.set(10);
  isSpinning.set(false);
  roundHistory.set([]);
  lastOutcome.set(null);
  isGameOver.set(false);
}
