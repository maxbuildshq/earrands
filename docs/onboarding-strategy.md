# Onboarding Strategy

**Status:** implemented (2026-07-04) — hints in `src/lib/onboarding.ts` + `src/components/onboarding/OnboardingHints.tsx`; welcome email in `supabase/functions/welcome-email/` + migration 029 (deploy steps below still pending)

## The problem

New visitors open a festival schedule, say "cool app," and leave. They don't notice artist bios and music samples, picks and ratings, clash detection, schedule sharing, stage filtering, or offline mode — and they don't sign up, because nothing tells them there's anything beyond the timetable. Signup nudges (`AuthPrompt`) only fire when a user *attempts* a gated action, but users don't attempt actions they don't know exist.

There is too much to explain to explain it all at once. The strategy is to drip hints contextually, at the moment each feature becomes relevant.

## Principles

1. **Contextual, not upfront.** One hint at a time, triggered by where the user is — never a multi-step tour.
2. **Highlight the real UI.** No screenshot assets: they go stale with every UI change, add weight to a cache-first PWA on bad networks, and can't match the live theme. Where a feature can't be seen in the user's current state, render a mini-mock with the real components/CSS instead.
3. **Brand voice** (see [brand.md](brand.md)): one line, direct, dismissible. The flyer test applies to every hint.
4. **Gating stays as-is.** Picks/ratings still require an account. Anonymous local picks (mark sets in localStorage, offer to save on signup) was considered and rejected: the "offer to save" trigger is unreliable to detect, "works on any device" doesn't sell to phone-only users, and the attempt-gated `AuthPrompt` is the cleaner conversion moment.

## First-visit detection (feasibility)

- Anonymous users have no Supabase session (`session: null` in `AuthContext`) — no anonymous auth is used, so detection is client-side.
- Per-hint localStorage flags: `onboarding:{hintId}`. Per-device, simple, matches existing keys (`layout-mode`, `stage-prefs:{festivalId}`).
- PostHog already assigns anonymous distinct IDs and merges them into the person on `posthog.identify` at signup — cross-session analytics works today.
- Caveat: iOS Safari ITP evicts localStorage after 7 days of inactivity for non-installed sites (installed PWA is exempt). Acceptable failure mode: a hint reappears once.

## Layer A — First-session contextual hints (in-UI)

Two visual forms:

- **Anchored spotlight hint** — for features visible on screen: a one-line tooltip anchored to the real button, with an accent-outline pulse on the target. Builds on the positioning approach of `useRevealTooltip` (src/hooks/useRevealTooltip.ts), adding a persistent seen-flag and the anchor highlight.
- **Inline mini-mock** — for features invisible in the user's current state (clashes before they have picks, the share poster, ratings): a small static mock rendered with the real components (e.g. two overlapping SetCards with the clash stripe, ~80px tall) inside the hint card. Zero image assets, always visually current, and doubles as pre-signup value display for gated features.

### Hint map (priority order)

Picks and clash visualization were merged into one hint (same feature, one card) after review. Offline mode is defined in code but disabled — not in the active order — until we're ready to turn it on.

| # | Feature | Form | Trigger moment | Copy draft |
|---|---|---|---|---|
| 1 | Artist info in SetSheet | Mock Instagram + SoundCloud icon buttons | First SchedulePage view | "Tap a set. Bio, socials, music." |
| 2 | Picks + clash detection | Inline + icon (as a character in the text) + clash mini-mock | After hint 1 dismissed, same or next session | "Tap + to build your own schedule. We'll handle the clashes." |
| 3 | Share links + poster | Mock share button + poster mini-mock | After hint 2, e.g. My Schedule visit | "Send your schedule to the group. Link or poster." |
| 4 | Stage filter / hide / pin | Mock stage row (visible+pinned vs. hidden) | Second SchedulePage session | "Hide the stages you're skipping. Pin the rest to the top." |
| — | Offline mode | (disabled, code kept) | — | "Works offline. Save your battery for the night." |

Cadence rules: max 1 hint visible at a time, capped at `SESSION_HINT_CAP` (2) per page-load session, dismiss = never shown again (`onboarding:{hintId}` flag). The hint card pulses with the same `.animate-pulse-glow` used on now-playing sets, so it doesn't get lost against the timetable. Hints 2–3 tell the pre-signup value story in sequence; tapping the + in hint 2 lands on `AuthPrompt`, which continues it.

## Layer B — Sell gated features before the tap (gating unchanged)

- **Picks hint (A#2)** makes the +/going icon stop being anonymous.
- **AuthPrompt copy upgrade** — today it sells only the immediate action ("mark sets you're going to and rate them"). Add one line of downstream payoff: clash detection and a shareable schedule. This is the highest-traffic conversion surface in the app.
  - Draft: "Create an account to pick your sets. We'll flag the clashes — and you get a schedule you can send to the group."
- **Anonymous My Schedule empty state** — a session-less user reaching My Schedule should see a value pitch (mini-mocks of the clash view and share poster) plus a signup CTA, not a bare gate. The nav item becomes a pitch page.

## Layer C — Post-signup welcome email

- **Not blocked by the marketing checkbox.** `marketingConsent` governs marketing communications. A single, strictly functional email explaining how the product the user just signed up for works is transactional / GDPR legitimate interest — the same category as the timetable-drop notifications already sent to followers. Conditions: 100% functional content, no promotion, unsubscribe link included. Goes to all confirmed signups. This is a deliberate, documented position.
- **One email, no drip sequence.** Content order: artist info → picks + clash detection (merged) → sharing → ratings → offline mode at the end.
- **Trigger: Supabase auth webhook → edge function → Resend**, real-time on signup confirmation. Reuse the HTML+text template-builder style from `scripts/lib/notify-helpers.ts`. `RESEND_API_KEY` lives as an edge-function secret, never client-side.

## Layer D — Measurement (do first — nearly free)

New PostHog events:

- `auth_prompt_shown` — prop `source`: `set_action | follow | request | my_schedule`. Closes the biggest funnel blind spot.
- `onboarding_hint_shown` / `onboarding_hint_dismissed` — both with a `hint_id` prop (one event name, per-hint filtering).
- `set_sheet_opened` — the first "went deeper than the timetable" signal.
- Share scenarios: extend `schedule_shared` with a `method` prop (`link_copied | poster_downloaded | native_share`); add `share_link_opened` on the receiving side alongside the existing `shared_schedule_saved`, so link-sharing, poster-export, and friend-import funnels are separable.

Also: enable PostHog session replay to watch real first sessions.

**Activation funnel:** land → `set_sheet_opened` → `auth_prompt_shown` → `user_signed_up` → first `set_plan_toggled` → `schedule_shared`.

## Out of scope / later

Multi-step tours · screenshot/video assets · PostHog feature-flag A/B tests (needs more traffic) · drip email sequences · anonymous local picks (rejected) · landing-page rework.

## Sequencing

1. **Measurement** — events + session replay; know the funnel before touching it.
2. **First-session hints** (Layer A), in priority order.
3. **AuthPrompt copy + anonymous My Schedule empty state** (Layer B).
4. **Welcome email** via Supabase auth webhook → edge function → Resend (Layer C).
