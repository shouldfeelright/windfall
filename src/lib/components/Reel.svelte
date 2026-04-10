<script lang="ts">
  import { onMount } from 'svelte';

  export let targetDigit: number;
  export let delay: number = 0;
  export let spinning: boolean = false;
  export let reducedMotion: boolean = false;
  export let onStop: (() => void) | undefined = undefined;

  let displayDigit = 0;
  let animating = false;
  let reelElement: HTMLDivElement;

  const CELL_HEIGHT = 72;
  const DESKTOP_CELL_HEIGHT = 88;
  let cellHeight = CELL_HEIGHT;

  let stripOffset = 0;

  onMount(() => {
    if (typeof window !== 'undefined') {
      cellHeight = window.innerWidth > 400 ? DESKTOP_CELL_HEIGHT : CELL_HEIGHT;
    }
  });

  $: if (spinning) {
    startSpin();
  }

  function startSpin(): void {
    if (reducedMotion) {
      displayDigit = targetDigit;
      animating = false;
      onStop?.();
      return;
    }

    animating = true;
    const totalDuration = 1200 + delay;
    const startTime = performance.now();
    const spinCycles = 3 + Math.floor(delay / 400);
    const totalDistance = (spinCycles * 10 + targetDigit) * cellHeight;

    function animate(now: number): void {
      const elapsed = now - startTime;
      if (elapsed < delay) {
        requestAnimationFrame(animate);
        const quickCycle = Math.floor((elapsed / 60) % 10);
        stripOffset = -(quickCycle * cellHeight);
        return;
      }

      const spinElapsed = elapsed - delay;
      const spinDuration = totalDuration - delay;
      const progress = Math.min(spinElapsed / spinDuration, 1);

      const eased = 1 - Math.pow(1 - progress, 3);
      const currentDistance = eased * totalDistance;
      const currentDigit = (Math.floor(currentDistance / cellHeight)) % 10;

      stripOffset = -(currentDigit * cellHeight);
      displayDigit = currentDigit;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        displayDigit = targetDigit;
        stripOffset = -(targetDigit * cellHeight);
        animating = false;
        onStop?.();
      }
    }

    requestAnimationFrame(animate);
  }
</script>

<div class="reel" bind:this={reelElement} class:animating>
  <div class="reel-window">
    <div class="reel-strip" style="transform: translateY({stripOffset}px)">
      {#each Array(10) as _, i}
        <div class="reel-cell" class:active={displayDigit === i}>
          {i}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .reel {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .reel-window {
    width: 72px;
    height: 72px;
    overflow: hidden;
    background: var(--color-surface-2);
    border-radius: var(--radius-md);
    box-shadow:
      inset 0 2px 8px rgba(0, 0, 0, 0.6),
      0 0 0 1px var(--color-border);
  }

  @media (min-width: 401px) {
    .reel-window {
      width: 88px;
      height: 88px;
    }
  }

  .reel-strip {
    will-change: transform;
  }

  .reel-cell {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--color-text-muted);
    user-select: none;
  }

  .reel-cell.active {
    color: var(--color-gold);
    text-shadow: 0 0 12px var(--color-gold-glow);
  }

  @media (min-width: 401px) {
    .reel-cell {
      width: 88px;
      height: 88px;
    }
  }
</style>
