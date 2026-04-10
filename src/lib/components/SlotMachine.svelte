<script lang="ts">
  import { onMount } from 'svelte';
  import Reel from './Reel.svelte';
  import BetControls from './BetControls.svelte';
  import ProfileBadge from './ProfileBadge.svelte';
  import RoundHistory from './RoundHistory.svelte';
  import {
    followers,
    betPct,
    isSpinning,
    isGameOver,
    lastOutcome,
    startingFollowers,
    totalRounds,
    recordSpin
  } from '$lib/stores/game';
  import { resolveOutcome } from '$lib/utils/outcomeEngine';
  import type { SpinOutcome } from '$lib/types';

  let outcome: SpinOutcome | null = null;
  let reelsStopped = 0;
  let reducedMotion = false;
  let confettiCanvas: HTMLCanvasElement;

  onMount(() => {
    if (typeof window !== 'undefined') {
      reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  });

  function handleSpin(): void {
    if ($isSpinning || $isGameOver || $followers <= 0) return;

    outcome = resolveOutcome($followers, $betPct);
    reelsStopped = 0;
    isSpinning.set(true);

    if (typeof window !== 'undefined' && window.posthog) {
      window.posthog.capture('spin_initiated', {
        bet_pct: $betPct,
        followers_before: $followers
      });
    }
  }

  function handleReelStop(): void {
    reelsStopped++;
    if (reelsStopped >= 3 && outcome) {
      isSpinning.set(false);
      recordSpin(outcome);

      if (typeof window !== 'undefined' && window.posthog) {
        window.posthog.capture('spin_completed', {
          outcome: outcome.type,
          multiplier: outcome.multiplier,
          followers_after: outcome.newTotal
        });

        if (outcome.newTotal <= 0) {
          window.posthog.capture('game_over', {
            total_rounds: $totalRounds,
            starting_followers: $startingFollowers
          });
        }
      }

      if (outcome.type === 'win') {
        fireConfetti();
      }

      outcome = null;
    }
  }

  function fireConfetti(): void {
    if (reducedMotion || !confettiCanvas) return;
    const ctx = confettiCanvas.getContext('2d');
    if (!ctx) return;

    confettiCanvas.width = confettiCanvas.offsetWidth;
    confettiCanvas.height = confettiCanvas.offsetHeight;

    const particles: {
      x: number; y: number;
      vx: number; vy: number;
      color: string; size: number;
      life: number;
    }[] = [];

    const colors = ['#f5c842', '#fad85a', '#39e07a', '#ff3c6e', '#f0ede8'];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: confettiCanvas.width / 2,
        y: confettiCanvas.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.8) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 2,
        life: 1
      });
    }

    function draw(): void {
      if (!ctx) return;
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;

      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.life -= 0.015;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }

      ctx.globalAlpha = 1;
      if (alive) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }

    requestAnimationFrame(draw);
  }

  $: resultMessage = (() => {
    if ($isGameOver) return 'Game over — you lost all your followers!';
    if (!$lastOutcome) return '';
    const lo = $lastOutcome;
    if (lo.type === 'win') return `You won ${Math.abs(lo.followerDelta).toLocaleString()} followers! (${lo.multiplier}x)`;
    if (lo.type === 'lose') return `You lost ${Math.abs(lo.followerDelta).toLocaleString()} followers.`;
    return 'Break even — no change.';
  })();

  $: resultClass =
    $lastOutcome?.type === 'win' ? 'win' :
    $lastOutcome?.type === 'lose' ? 'lose' : '';
</script>

<section class="slot-machine">
  <canvas class="confetti-canvas" bind:this={confettiCanvas} aria-hidden="true"></canvas>

  <ProfileBadge />

  <div class="reels">
    <Reel
      targetDigit={outcome?.reelDigits[0] ?? 0}
      delay={0}
      spinning={$isSpinning}
      {reducedMotion}
      onStop={handleReelStop}
    />
    <Reel
      targetDigit={outcome?.reelDigits[1] ?? 0}
      delay={300}
      spinning={$isSpinning}
      {reducedMotion}
      onStop={handleReelStop}
    />
    <Reel
      targetDigit={outcome?.reelDigits[2] ?? 0}
      delay={600}
      spinning={$isSpinning}
      {reducedMotion}
      onStop={handleReelStop}
    />
  </div>

  {#if resultMessage}
    <p class="result-message {resultClass}" class:game-over={$isGameOver}>
      {resultMessage}
    </p>
  {/if}

  <BetControls />

  <button
    class="spin-button"
    disabled={$isSpinning || $isGameOver || $followers <= 0}
    on:click={handleSpin}
  >
    {#if $isSpinning}
      SPINNING…
    {:else if $isGameOver}
      GAME OVER
    {:else}
      SPIN
    {/if}
  </button>

  <RoundHistory />
</section>

<style>
  .slot-machine {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-6) var(--space-4);
    max-width: 480px;
    margin: 0 auto;
  }

  .confetti-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
  }

  .reels {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.4),
      0 0 0 1px var(--color-border);
  }

  .result-message {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--color-text-muted);
    text-align: center;
    min-height: 1.5em;
  }

  .result-message.win {
    color: var(--color-green);
  }

  .result-message.lose {
    color: var(--color-pink);
  }

  .result-message.game-over {
    color: var(--color-pink);
    font-weight: 700;
  }

  .spin-button {
    min-width: 200px;
    min-height: 56px;
    padding: var(--space-3) var(--space-8);
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--color-bg);
    background: var(--color-gold);
    border-radius: var(--radius-full);
    transition: all var(--transition);
    box-shadow: 0 0 20px var(--color-gold-glow);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .spin-button:hover:not(:disabled) {
    background: var(--color-gold-hover);
    box-shadow: 0 0 30px var(--color-gold-glow);
    transform: translateY(-1px);
  }

  .spin-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .spin-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
