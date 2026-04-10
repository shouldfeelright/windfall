import type { SpinOutcome } from '$lib/types';

function randomDigit(): number {
  return Math.floor(Math.random() * 10);
}

function winDigits(): [number, number, number] {
  const d = randomDigit();
  return [d, d, d];
}

function breakEvenDigits(): [number, number, number] {
  const d = randomDigit();
  let third = randomDigit();
  while (third === d) {
    third = randomDigit();
  }
  return [d, d, third];
}

function loseDigits(): [number, number, number] {
  const a = randomDigit();
  let b = randomDigit();
  while (b === a) {
    b = randomDigit();
  }
  let c = randomDigit();
  while (c === a || c === b) {
    c = randomDigit();
  }
  return [a, b, c];
}

function pickWinMultiplier(): number {
  const roll = Math.random();
  if (roll < 0.5) return 2.0;
  if (roll < 0.8) return 1.5;
  return 3.0;
}

export function resolveOutcome(currentFollowers: number, betPct: number): SpinOutcome {
  const betAmount = Math.floor(currentFollowers * (betPct / 100));
  const roll = Math.random();

  if (roll < 0.45) {
    const multiplier = pickWinMultiplier();
    const winnings = Math.floor(betAmount * multiplier);
    return {
      type: 'win',
      reelDigits: winDigits(),
      multiplier,
      followerDelta: winnings,
      newTotal: currentFollowers + winnings
    };
  }

  if (roll < 0.90) {
    return {
      type: 'lose',
      reelDigits: loseDigits(),
      multiplier: 0,
      followerDelta: -betAmount,
      newTotal: Math.max(0, currentFollowers - betAmount)
    };
  }

  return {
    type: 'break-even',
    reelDigits: breakEvenDigits(),
    multiplier: 1.0,
    followerDelta: 0,
    newTotal: currentFollowers
  };
}
