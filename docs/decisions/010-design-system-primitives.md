# 010 — Design tokens: `accent`/`negative`, and shared `src/components/ui/` primitives

**Status:** Accepted (UX revamp).

**Decision:** Rename `--color-acid` → `--color-accent` (and `-dim` variant); split the overloaded `--color-live` into `--color-live` (Live badge only) and `--color-negative` (negative rating active state, form/validation errors). Introduce `src/components/ui/` primitives — `Button`, `Input`, `Label`, `Heading`, `Badge` — as the canonical building blocks for these elements; new code should use them instead of hand-rolled utility classes.

## Why

A full UI audit (every button/input/label across the app) found the same handful of patterns retyped slightly differently in a dozen files: inconsistent idle backgrounds on toggle buttons, missing `font-bold` on some buttons, `py-3` vs `py-2.5` padding drift, inputs using `bg-surface` in sheets but `bg-surface-raised` on auth pages, and a literal bug — `hover:text-accent` was already written in `SetSheet.tsx` before `--color-accent` existed, so the hover silently did nothing.

`acid` named the *color*, not its *role*. If the brand color ever changes, `--color-acid` becomes a lie; `--color-accent` stays correct. Same logic for `--color-live`: it was being reused as "the red" for three unrelated things (Live badge, negative rating, error text) just because red was already defined under that name.

Tailwind's font-size/spacing scale is intentionally left as framework defaults (`text-xs`/`text-sm`/etc. — not overridden in `@theme`). The actual gap was never the scale, it was that *which size/variant to use for a given semantic role* (button, label, field) wasn't codified anywhere. React primitives with a `variant` prop fix that with type safety; a CSS `@layer components` approach was considered but rejected — it's invisible to TypeScript and doesn't get autocomplete.

## How to apply

- Use `text-accent` / `bg-accent` / `border-accent` (and `-dim`) for the brand highlight — never reintroduce `acid` naming.
- Use `text-negative` / `bg-negative` / `border-negative` for error text and "Not for me" / negative-rating active states. `--color-live` is reserved for the Live badge only — don't reuse it for new red things.
- For any new button, reach for `Button` (`src/components/ui/Button.tsx`) instead of typing out the class string again. Variant guide:
  - `primary` / `secondary` / `accent-outline` — full-width standalone CTAs.
  - `accent-toggle` — full-width CTA that solid-fills when active, accent-outlined when idle (e.g. follow/notify banners).
  - `icon` / `icon-toggle` / `danger` — square 32×32 icon buttons (chrome actions / toggles / destructive toggle).
  - `segment` — borderless item inside a *shared-border* group (day chips, All/Picks, layout toggle); the group div supplies the outer `border` + `border-l` dividers, not the button.
  - `choice` — bordered standalone item in a group with *no* shared outer border (sentiment picker, share-template picker).
  - Use `fullWidth={false}` plus a `className` override for padding/sizing on non-default-shaped buttons; use the `!` important prefix (e.g. `!py-1.5`) only when overriding a baked-in size from `BASE_FULL`/`BASE_ICON` — plain class concatenation order is not a reliable override mechanism in Tailwind.
- `Heading` (`src/components/ui/Heading.tsx`) centralizes heading typography: `page` (text-2xl, full-screen auth titles), `content` (text-lg accent, in-app content-page titles like Shared Schedule), `section` (text-xs uppercase tracking-widest, color supplied by caller — e.g. FestivalListPage's Upcoming/Past), `sheet` (text-lg neutral, BottomSheet's title). It does **not** cover card titles (`h3`), the header wordmark, or body text — those stay local to their component.
- `Badge` (`src/components/ui/Badge.tsx`) centralizes small uppercase pills: `live` (red, Live badge only), `accent` (solid, e.g. timetable-announced / NOW indicator), `accent-outline`, `outline` (neutral, e.g. Past).
- `Label` is scoped to form-field captions only (the small uppercase text above an input) — it is not a generic "all text" component.
- `TimetableSetBlock`'s pixel positions and `color-mix()` backgrounds stay inline `style={}` — that's data-driven, not a styling inconsistency, and not in scope for the primitives migration.
- Known deferred items (intentionally out of scope, left as raw markup — each is either a single-use layout that doesn't fit an existing variant, or a structural duplication tracked separately): `SetSheet` still duplicates `BottomSheet`'s shell instead of using it; `OfflineNotice` reuses `bg-conflict` for an unrelated offline state; `RequestFestivalCTA`'s two-span row trigger; the Share icon button and TimetableGrid's Stages-cell border-vs-borderless asymmetry (intentional — one is a toolbar chip, the other blends into a grid header row).
