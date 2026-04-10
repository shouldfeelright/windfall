# FollowBet — Technical Requirements Document
**Version:** 1.0
**Status:** Active
**Last Updated:** April 2026
**Author:** [Your Name]

---

## 1. Product Overview

FollowBet is a single-page web application that lets users gamble their real Instagram follower count on a slot machine UI. The user enters their Instagram handle, the app fetches their actual follower count via a server-side API proxy, and the slot machine simulates winning or losing followers across multiple spins.

The core experience mirrors a real slot machine: the user never inputs how much they have — the app knows. Stakes feel real because the number is real.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | SvelteKit | Full-stack; handles both UI and API routes |
| **Language** | TypeScript | Strict mode enabled |
| **Styling** | CSS (custom properties) | No Tailwind; use the design token system defined in Section 7 |
| **Instagram Data** | SociaVault API (or RapidAPI equivalent) | Proxied through a SvelteKit server route — API key never exposed to client |
| **Caching / Rate Limiting** | Upstash Redis | Free tier; persists rate limit state across serverless instances |
| **Analytics** | PostHog | Initialized in `+layout.svelte`; track custom events defined in Section 6 |
| **Hosting** | Vercel | Hobby tier; serverless functions via SvelteKit adapter-vercel |
| **Secrets** | Vercel Environment Variables | Never hardcoded; never committed to git |

---

## 3. Repository Structure

```
followbet/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte         # PostHog init, global styles, font loading
│   │   ├── +page.svelte           # Main single-page UI
│   │   └── api/
│   │       └── followers/
│   │           └── +server.ts     # Server-only Instagram proxy route
│   ├── lib/
│   │   ├── components/
│   │   │   ├── SlotMachine.svelte
│   │   │   ├── Reel.svelte
│   │   │   ├── BetControls.svelte
│   │   │   ├── ProfileBadge.svelte
│   │   │   └── RoundHistory.svelte
│   │   ├── stores/
│   │   │   └── game.ts            # Svelte store: followers, betPct, history, phase
│   │   ├── utils/
│   │   │   ├── outcomeEngine.ts   # Pure function: spin logic, probability, payouts
│   │   │   ├── formatFollowers.ts # e.g. 4200 → "4.2K"
│   │   │   └── circuitBreaker.ts  # Global daily API call counter
│   │   └── types.ts               # Shared TypeScript interfaces
├── static/
│   └── favicon.svg
├── .env.example                   # Template for required env vars (no real values)
├── .env                           # Gitignored — real secrets live here locally
├── CURSOR_RULES.md                # Agent behavior and coding standards
├── REQUIREMENTS.md                # This file
└── README.md
```

---

## 4. Functional Requirements

### 4.1 Handle Input Screen (Phase: `input`)

- [ ] User sees a single input field for their Instagram handle
- [ ] Handle input strips leading `@` before sending to API
- [ ] On submit, app calls `GET /api/followers?handle={handle}`
- [ ] While fetching, a loading state is shown on the submit button (spinner or animated label)
- [ ] On success, app transitions to the slot machine phase with the real follower count
- [ ] On API error (handle not found, private account, rate limit, circuit breaker), a specific inline error message is shown per the error type defined in Section 4.4
- [ ] Input is validated client-side: no empty submission, min 1 character, max 30 characters, alphanumeric + underscores + periods only

### 4.2 Slot Machine Screen (Phase: `playing`)

- [ ] A profile badge displays the handle and live follower count at the top
- [ ] Three animated reels display digits (0–9); on spin they animate and stop in sequence (reel 1 → reel 2 → reel 3), each decelerating with an ease-out curve
- [ ] The outcome (win/lose/break-even) and resulting reel digits are **determined before animation starts**; animation reveals a predetermined result
- [ ] Bet size is selected via chip buttons: 5%, 10%, 25%, 50%, ALL IN
- [ ] Current followers display updates after each spin with a color transition (green for gain, red for loss)
- [ ] A result message is shown below the reels after each spin
- [ ] The spin button is disabled during animation and re-enabled on completion
- [ ] If followers reach 0, the spin button is permanently disabled and a game-over message is shown
- [ ] A round history panel below the machine logs each spin: outcome, delta, new total

### 4.3 Outcome Engine (`src/lib/utils/outcomeEngine.ts`)

This must be a **pure function** — no side effects, no DOM access, fully unit-testable.

```ts
type SpinOutcome = {
  type: 'win' | 'lose' | 'break-even';
  reelDigits: [number, number, number]; // 0–9 each
  multiplier: number;                   // 1.5, 2.0, or 3.0 for wins; 0 for losses; 1.0 for break-even
  followerDelta: number;                // signed integer; negative for losses
  newTotal: number;
}

function resolveOutcome(currentFollowers: number, betPct: number): SpinOutcome
```

Probability distribution:

- **45%** — Win. Multipliers: 50% chance of 2x, 30% chance of 1.5x, 20% chance of 3x
- **45%** — Lose. User loses the bet amount entirely
- **10%** — Break even. No follower change

Reel digit rules:

- Win: all three digits match
- Break-even: first two digits match, third differs
- Lose: all three digits differ

### 4.4 Error States

Every error must show an **inline message** below the handle input — never a raw HTTP error code.

| Error Condition | User-Facing Message |
|---|---|
| Handle not found / private account | "We couldn't find that account. Make sure it's public and spelled correctly." |
| Rate limit hit (per-IP) | "You're moving fast — wait a minute before trying again." |
| Circuit breaker tripped | "FollowBet is taking a breather from high traffic. Try again in a few hours." |
| Scraper API error / timeout | "Instagram is being tricky right now. Try again in a moment." |

---

## 5. API Route — `GET /api/followers`

**File:** `src/routes/api/followers/+server.ts`
**Access:** Server-only. This file must never import client-side code.

### Request

```
GET /api/followers?handle=somehandle
```

### Response — Success `200`

```json
{ "followers": 42100, "cached": false }
```

### Response — Error `4xx/5xx`

```json
{ "error": "HANDLE_NOT_FOUND" }
```

Error codes: `HANDLE_NOT_FOUND`, `PRIVATE_ACCOUNT`, `RATE_LIMITED`, `CIRCUIT_BREAKER`, `UPSTREAM_ERROR`

### Server-Side Logic (in order)

1. **Validate** handle param — reject if empty or invalid characters → `400`
2. **Check per-IP rate limit** via Upstash Redis: max **5 requests per IP per 60 seconds** → `429 RATE_LIMITED`
3. **Check cache** via Upstash Redis: if a result for this handle exists and is < 15 minutes old, return it with `"cached": true` — do NOT call the scraper API
4. **Check circuit breaker**: if daily call count ≥ `DAILY_API_LIMIT` env var → `503 CIRCUIT_BREAKER`
5. **Call scraper API** with `SCRAPER_API_KEY` from environment
6. **Increment** daily call counter in Upstash Redis
7. **Write result to cache** with 15-minute TTL
8. **Return** follower count to client

---

## 6. Analytics Events (PostHog)

Initialize PostHog in `+layout.svelte` using `PUBLIC_POSTHOG_KEY` env var.

| Event Name | When Fired | Properties |
|---|---|---|
| `handle_submitted` | User submits handle | `{ handle_length: number }` — never log the handle itself |
| `followers_loaded` | API returns successfully | `{ cached: boolean, follower_bucket: string }` — bucket: "0-1K", "1K-10K", "10K-100K", "100K+" |
| `api_error` | API returns an error | `{ error_code: string }` |
| `spin_initiated` | User clicks spin | `{ bet_pct: number, followers_before: number }` |
| `spin_completed` | Animation finishes | `{ outcome: string, multiplier: number, followers_after: number }` |
| `game_over` | Followers reach 0 | `{ total_rounds: number, starting_followers: number }` |
| `rate_limit_hit` | 429 returned | `{}` |
| `circuit_breaker_tripped` | 503 returned | `{}` |

> ⚠️ **Never log a user's Instagram handle or exact follower count as a PostHog property.** Use buckets for follower ranges and omit the handle entirely for privacy.

---

## 7. Design System

### Aesthetic Direction

Casino / neon arcade. Deep near-black surfaces, gold primary accent, neon pink for loss states, neon green for win states. Space Mono for all numeric/display text. Space Grotesk for all UI body text.

### Fonts

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

### CSS Custom Properties (paste into `app.css`)

```css
:root {
  /* Type */
  --font-display: 'Space Mono', monospace;
  --font-body: 'Space Grotesk', sans-serif;
  --text-xs:   clamp(0.75rem,  0.7rem  + 0.25vw, 0.875rem);
  --text-sm:   clamp(0.875rem, 0.8rem  + 0.35vw, 1rem);
  --text-base: clamp(1rem,     0.95rem + 0.25vw, 1.125rem);
  --text-lg:   clamp(1.125rem, 1rem    + 0.75vw, 1.5rem);
  --text-xl:   clamp(1.5rem,   1.2rem  + 1.25vw, 2.25rem);

  /* Spacing */
  --space-1: 0.25rem; --space-2: 0.5rem;  --space-3: 0.75rem;
  --space-4: 1rem;    --space-6: 1.5rem;  --space-8: 2rem;
  --space-10: 2.5rem; --space-12: 3rem;   --space-16: 4rem;

  /* Surfaces */
  --color-bg:             #0a0908;
  --color-surface:        #100f0d;
  --color-surface-2:      #161412;
  --color-surface-offset: #1e1c19;
  --color-border:         rgba(255,255,255,0.08);

  /* Text */
  --color-text:           #f0ede8;
  --color-text-muted:     #9a9690;
  --color-text-faint:     #4a4844;

  /* Accents */
  --color-gold:           #f5c842;
  --color-gold-hover:     #fad85a;
  --color-gold-dim:       rgba(245,200,66,0.15);
  --color-gold-glow:      rgba(245,200,66,0.35);
  --color-pink:           #ff3c6e;
  --color-green:          #39e07a;

  /* Radius */
  --radius-sm: 0.375rem; --radius-md: 0.5rem;
  --radius-lg: 0.75rem;  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Transitions */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --transition: 180ms var(--ease-out);
}
```

### Component Rules

- Reel cells are `88×88px` on desktop, `72×72px` on mobile (≤400px)
- Reels animate via `requestAnimationFrame` with ease-out deceleration — no CSS transitions on the reel strip
- Confetti fires on win using Canvas 2D — no external library
- All interactive elements have a minimum touch target of `44×44px`
- No colored side borders on cards — use surface elevation (background + shadow) only

---

## 8. Cost Control & Rate Limiting

### Environment Variables Required

```
SCRAPER_API_KEY=          # Your SociaVault / RapidAPI key
DAILY_API_LIMIT=400       # Hard cap on scraper API calls per day (set below your free tier)
UPSTASH_REDIS_REST_URL=   # From Upstash dashboard
UPSTASH_REDIS_REST_TOKEN= # From Upstash dashboard
PUBLIC_POSTHOG_KEY=       # Client-safe PostHog project key
```

### Limits Summary

| Control | Value | Location |
|---|---|---|
| Per-IP rate limit | 5 requests / 60 seconds | Upstash Redis |
| Handle cache TTL | 15 minutes | Upstash Redis |
| Daily API call cap | `DAILY_API_LIMIT` env var | Upstash Redis counter |
| Vercel spend cap | Set manually in Vercel dashboard | Vercel Billing |
| Scraper API monthly limit | Set manually in provider dashboard | Provider dashboard |

---

## 9. Non-Functional Requirements

- [ ] Works at 375px (mobile) and 1280px+ (desktop)
- [ ] No `localStorage` or `sessionStorage` — all state is in-memory
- [ ] All external links use `target="_blank" rel="noopener noreferrer"`
- [ ] Semantic HTML throughout (`<main>`, `<section>`, `<button>`, etc.)
- [ ] All `<img>` tags include `alt`, `width`, `height`, and `loading="lazy"`
- [ ] `prefers-reduced-motion` disables reel animations; result is shown immediately
- [ ] TypeScript strict mode — no `any` types
- [ ] No secrets in source code or git history

---

## 10. Out of Scope (V1)

- User accounts or authentication
- Persistent leaderboards or score saving
- Real money or real Instagram account changes
- Push notifications or email
- Native mobile app
- Instagram OAuth integration
- Support for private Instagram accounts

---

## 11. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Which scraper API provider — SociaVault or RapidAPI? | **Open** — evaluate free tier limits before committing |
| 2 | What is the UI behavior when the circuit breaker trips mid-session (after followers are already loaded)? | **Open** — likely show degraded mode with last known count |
| 3 | Should the handle cache be shared across all users (global) or per-user? | **Resolved** — global cache; same handle returns same count for 15 min for all users |
