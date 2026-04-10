<script lang="ts">
  import { browser } from '$app/environment';
  import { phase, startGame } from '$lib/stores/game';
  import { followerBucket } from '$lib/utils/formatFollowers';
  import SlotMachine from '$lib/components/SlotMachine.svelte';
  import type { ApiErrorCode, ApiResponse, ApiErrorResponse } from '$lib/types';

  let handleInput = '';
  let loading = false;
  let errorMessage = '';

  const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
    HANDLE_NOT_FOUND: "We couldn't find that account. Make sure it's public and spelled correctly.",
    PRIVATE_ACCOUNT: "We couldn't find that account. Make sure it's public and spelled correctly.",
    RATE_LIMITED: "You're moving fast — wait a minute before trying again.",
    CIRCUIT_BREAKER: 'Windfall is taking a breather from high traffic. Try again in a few hours.',
    UPSTREAM_ERROR: 'Instagram is being tricky right now. Try again in a moment.'
  };

  const HANDLE_REGEX = /^[a-zA-Z0-9_.]{1,30}$/;

  function sanitizeHandle(raw: string): string {
    return raw.startsWith('@') ? raw.slice(1) : raw;
  }

  function isValidHandle(value: string): boolean {
    return value.length >= 1 && value.length <= 30 && HANDLE_REGEX.test(value);
  }

  function isErrorResponse(response: ApiResponse): response is ApiErrorResponse {
    return 'error' in response;
  }

  async function handleSubmit(): Promise<void> {
    errorMessage = '';
    const clean = sanitizeHandle(handleInput.trim());

    if (!clean || !isValidHandle(clean)) {
      errorMessage = "We couldn't find that account. Make sure it's public and spelled correctly.";
      return;
    }

    loading = true;

    if (browser && window.posthog) {
      window.posthog.capture('handle_submitted', { handle_length: clean.length });
    }

    try {
      const res = await fetch(`/api/followers?handle=${encodeURIComponent(clean)}`);
      const data: ApiResponse = await res.json();

      if (!res.ok || isErrorResponse(data)) {
        const errorCode = isErrorResponse(data) ? data.error : 'UPSTREAM_ERROR';

        if (browser && window.posthog) {
          window.posthog.capture('api_error', { error_code: errorCode });
          if (res.status === 429) window.posthog.capture('rate_limit_hit', {});
          if (res.status === 503 && errorCode === 'CIRCUIT_BREAKER') {
            window.posthog.capture('circuit_breaker_tripped', {});
          }
        }

        errorMessage = ERROR_MESSAGES[errorCode as ApiErrorCode] ?? ERROR_MESSAGES.UPSTREAM_ERROR;
        loading = false;
        return;
      }

      if (browser && window.posthog) {
        window.posthog.capture('followers_loaded', {
          cached: data.cached,
          follower_bucket: followerBucket(data.followers)
        });
      }

      startGame(clean, data.followers);
    } catch {
      errorMessage = ERROR_MESSAGES.UPSTREAM_ERROR;
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Windfall — Gamble Your Followers</title>
  <meta name="description" content="Enter your Instagram handle and gamble your real follower count on a slot machine." />
</svelte:head>

<main>
  {#if $phase === 'input'}
    <section class="input-screen">
      <div class="brand">
        <h1 class="logo">Windfall</h1>
        <p class="tagline">Gamble your followers. No real stakes. All the drama.</p>
      </div>

      <form class="handle-form" on:submit|preventDefault={handleSubmit}>
        <div class="input-wrapper">
          <span class="at-sign">@</span>
          <input
            type="text"
            bind:value={handleInput}
            placeholder="your_handle"
            maxlength="31"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            disabled={loading}
          />
        </div>

        <button type="submit" class="submit-btn" disabled={loading}>
          {#if loading}
            <span class="spinner" aria-hidden="true"></span>
            Loading…
          {:else}
            Let's Go
          {/if}
        </button>

        {#if errorMessage}
          <p class="error-message" role="alert">{errorMessage}</p>
        {/if}
      </form>
    </section>
  {:else}
    <SlotMachine />
  {/if}
</main>

<style>
  main {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
  }

  .input-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    max-width: 400px;
    width: 100%;
  }

  .brand {
    text-align: center;
  }

  .logo {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 2rem + 3vw, 4rem);
    font-weight: 700;
    color: var(--color-gold);
    text-shadow: 0 0 40px var(--color-gold-glow);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .tagline {
    margin-top: var(--space-3);
    font-size: var(--text-base);
    color: var(--color-text-muted);
    max-width: 28ch;
    margin-inline: auto;
  }

  .handle-form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: border-color var(--transition);
  }

  .input-wrapper:focus-within {
    border-color: var(--color-gold);
    box-shadow: 0 0 0 3px var(--color-gold-dim);
  }

  .at-sign {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    color: var(--color-text-faint);
    user-select: none;
  }

  input {
    flex: 1;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    padding: var(--space-1) 0;
    min-height: 44px;
  }

  input::placeholder {
    color: var(--color-text-faint);
  }

  input:focus {
    outline: none;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-width: 200px;
    min-height: 52px;
    padding: var(--space-3) var(--space-8);
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--color-bg);
    background: var(--color-gold);
    border-radius: var(--radius-full);
    transition: all var(--transition);
    box-shadow: 0 0 20px var(--color-gold-glow);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-gold-hover);
    box-shadow: 0 0 30px var(--color-gold-glow);
    transform: translateY(-1px);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-bg);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    color: var(--color-pink);
    font-size: var(--text-sm);
    text-align: center;
    max-width: 300px;
  }
</style>
