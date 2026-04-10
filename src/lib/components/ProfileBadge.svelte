<script lang="ts">
  import { handle, followers, lastOutcome } from '$lib/stores/game';
  import { formatFollowers } from '$lib/utils/formatFollowers';

  $: outcomeClass =
    $lastOutcome?.type === 'win' ? 'gain' :
    $lastOutcome?.type === 'lose' ? 'loss' : '';
</script>

<div class="profile-badge">
  <span class="handle">@{$handle}</span>
  <span class="follower-count" class:gain={outcomeClass === 'gain'} class:loss={outcomeClass === 'loss'}>
    {formatFollowers($followers)} followers
  </span>
</div>

<style>
  .profile-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-4);
  }

  .handle {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .follower-count {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--color-gold);
    transition: color var(--transition);
  }

  .follower-count.gain {
    color: var(--color-green);
  }

  .follower-count.loss {
    color: var(--color-pink);
  }
</style>
