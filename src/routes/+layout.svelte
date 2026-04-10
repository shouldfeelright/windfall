<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { PUBLIC_POSTHOG_KEY } from '$env/static/public';
  import '../app.css';

  onMount(async () => {
    if (browser && PUBLIC_POSTHOG_KEY) {
      const { default: posthog } = await import('posthog-js');
      posthog.init(PUBLIC_POSTHOG_KEY, {
        api_host: 'https://us.i.posthog.com',
        capture_pageview: false,
        persistence: 'memory'
      });
      window.posthog = posthog;
    }
  });
</script>

<slot />
