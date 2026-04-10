<script lang="ts">
  import { betPct, isSpinning, isGameOver } from '$lib/stores/game';
  import type { BetPercent } from '$lib/types';

  const chips: { value: BetPercent; label: string }[] = [
    { value: 5, label: '5%' },
    { value: 10, label: '10%' },
    { value: 25, label: '25%' },
    { value: 50, label: '50%' },
    { value: 100, label: 'ALL IN' }
  ];

  function handleSelect(value: BetPercent): void {
    if (!$isSpinning && !$isGameOver) {
      betPct.set(value);
    }
  }
</script>

<div class="bet-controls">
  <span class="label">BET</span>
  <div class="chips">
    {#each chips as chip}
      <button
        class="chip"
        class:active={$betPct === chip.value}
        disabled={$isSpinning || $isGameOver}
        on:click={() => handleSelect(chip.value)}
      >
        {chip.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .bet-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .label {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    color: var(--color-text-faint);
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  .chips {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: center;
  }

  .chip {
    min-width: 44px;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--color-text-muted);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    transition: all var(--transition);
  }

  .chip:hover:not(:disabled) {
    border-color: var(--color-gold-dim);
    color: var(--color-text);
  }

  .chip.active {
    background: var(--color-gold-dim);
    border-color: var(--color-gold);
    color: var(--color-gold);
    box-shadow: 0 0 12px var(--color-gold-glow);
  }

  .chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
