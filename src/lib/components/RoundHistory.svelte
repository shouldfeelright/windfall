<script lang="ts">
  import { roundHistory } from '$lib/stores/game';
  import { formatFollowers } from '$lib/utils/formatFollowers';
</script>

{#if $roundHistory.length > 0}
  <section class="round-history">
    <h3 class="title">History</h3>
    <div class="list">
      {#each [...$roundHistory].reverse() as record (record.round)}
        <div class="row" class:win={record.outcome === 'win'} class:lose={record.outcome === 'lose'}>
          <span class="round-num">#{record.round}</span>
          <span class="outcome">{record.outcome}</span>
          <span class="delta">
            {record.delta >= 0 ? '+' : ''}{formatFollowers(Math.abs(record.delta))}
          </span>
          <span class="total">{formatFollowers(record.total)}</span>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .round-history {
    width: 100%;
    max-width: 420px;
    margin: 0 auto;
  }

  .title {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    color: var(--color-text-faint);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    text-align: center;
    margin-bottom: var(--space-3);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-height: 240px;
    overflow-y: auto;
  }

  .row {
    display: grid;
    grid-template-columns: 2.5rem 5rem 1fr 1fr;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-sm);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .round-num {
    color: var(--color-text-faint);
  }

  .outcome {
    text-transform: capitalize;
  }

  .delta {
    text-align: right;
  }

  .total {
    text-align: right;
    color: var(--color-text);
  }

  .row.win .outcome,
  .row.win .delta {
    color: var(--color-green);
  }

  .row.lose .outcome,
  .row.lose .delta {
    color: var(--color-pink);
  }
</style>
