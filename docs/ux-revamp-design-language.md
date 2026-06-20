# UX revamp — design language (current state)

Design decisions, token system, and component semantics as implemented. This is a living snapshot — update it when decisions change, don't layer deltas on top.

---

## Colour system

All tokens live in `src/index.css` inside `@theme {}`. Use CSS variables everywhere; no hardcoded hex in components.

| Token | Value | Meaning |
|---|---|---|
| `--color-accent` | `#CCFF00` | Primary action, now/live, active state fill |
| `--color-accent-dim` | `#99CC00` | Accent hover state |
| `--color-surface` | `#0A0A0A` | Page background |
| `--color-surface-raised` | `#141414` | Cards, set blocks, sheets |
| `--color-surface-hover` | `#1E1E1E` | Card hover state |
| `--color-border` | `#444444` | Standard borders |
| `--color-border-subtle` | `#2C2C2C` | Timetable block borders, secondary dividers |
| `--color-text-primary` | `#E5E5E5` | Body text |
| `--color-text-secondary` | `#FFFFFF` | **White** (not grey) — outdoor sunlight legibility ([001](decisions/001-outdoor-contrast.md)) |
| `--color-text-dim` | `#8A8A8A` | De-emphasised text, inactive timetable button icons |
| `--color-live` | `#FF3B3B` | LIVE badge only |
| `--color-negative` | `#FF3B3B` | Rating down (thumb-down active state) |
| `--color-conflict` | `#FF6B2B` | Clash indicator — hazard stripe + left border + CLASH badge |
| `--color-grid-line` | `#161616` | Vertical hour lines in timetable |
| `--color-lane-line` | `#1C1C1C` | Stage lane separators in timetable |
| `--shadow-now` | `0 0 20px rgba(204,255,0,0.4), 0 0 40px rgba(204,255,0,0.15)` | Glow for now-playing set card in list view |

`--color-live` and `--color-negative` share the same hex today but are **semantically separate** — `live` is for the LIVE badge only, `negative` is for error/negative-rating states. Do not interchange them.

---

## Typography

**Chakra Petch** app-wide, loaded via `@fontsource`. Squared techno grotesk — readable for dense artist/stage names, underground character. See [009](decisions/009-typography-chakra-petch.md).

The `font-mono` Tailwind utility maps to Chakra Petch (it is the only font registered).

---

## Design language

Dark, raw, industrial brutalist. Techno festival, not a startup dashboard.

- Near-black background, acid lime accent
- High contrast everywhere — outdoor sunlight is the primary legibility constraint
- Functional density over decoration
- Monospaced typography, uppercase labels, tight tracking
- Conflict = hazard caution-tape stripe, not a colour badge — decoupled from the accent so it doesn't compete

---

## UI primitives — `src/components/ui/`

Use these for all new UI. Do not retype their Tailwind strings inline.

### Button (`Button.tsx`)

`<Button variant="..." active={bool} fullWidth={bool}>` — renders a `<button>`.

**Full-width variants** (default `w-full`, override with `fullWidth={false}`):

| Variant | When to use |
|---|---|
| `primary` | Solid lime fill. Primary CTA (sign up, confirm). |
| `secondary` | Bordered, grey text. Secondary CTA. |
| `accent-outline` | Lime border, lime text. Static CTA with no active/inactive state (e.g. Share). |
| `accent-toggle` | Lime border/text inactive → solid lime fill active. Stateful toggle that also serves as a CTA when off (e.g. Follow festival). `accent-outline` and `accent-toggle` look identical when inactive — they are semantically distinct: use `accent-outline` for static actions, `accent-toggle` for stateful ones. |

**Icon variants** (32×32, fixed size):

| Variant | When to use |
|---|---|
| `icon` | Bordered 32×32. Sheet close, list-mode Stages button, zoom controls. |
| `icon-toggle` | Bordered 32×32, lime fill when active. Going toggle in SetCard/SetSheet. |
| `icon-bare` | No border. Persistent header/nav icons (logout, feedback). Also exported as `ICON_BARE_CLASS` string for non-button elements (e.g. `<Link>` for login — same visual, correct semantics). |
| `danger` | Bordered 32×32, red fill when active. Rating-down (thumb-down). |

**Group/choice variants:**

| Variant | When to use |
|---|---|
| `segment` | Borderless, shared-border group (DayToggle, All/Picks, Timetable/List). Active = solid lime fill. |
| `choice` | Bordered standalone item. Sentiment picker (love/fine/frustrating), share template selector. Active = solid lime fill. |

`ICON_BARE_CLASS` is exported so `<Link>` elements can use the same class string when the element must be an anchor (`/login` icon in header).

**Cursor:** All `<button>`, `<a>`, `[role="button"]` get `cursor: pointer` via a global CSS rule in `index.css`.

---

### Heading (`Heading.tsx`)

`<Heading variant="..." as={ElementType}>` — renders a semantic heading tag, overridable via `as`.

| Variant | Tag | Style | Use for |
|---|---|---|---|
| `page` | `h1` | `text-2xl text-accent tracking-tight` | Page titles (LOGIN, FESTIVALS) |
| `content` | `h1` | `text-lg text-accent tracking-tight` | Section-level heading within a page |
| `section` | `h2` | `text-xs uppercase tracking-widest` | **No default colour** — callers must provide `className="text-accent"` or `"text-text-secondary"`. Tailwind v4 cascade ordering makes a default color unsafe here. Used for "Upcoming", "Past", "After midnight". |
| `sheet` | `h2` | `text-lg text-text-primary leading-tight` | BottomSheet titles (passed via `title` prop) |
| `card` | `h3` | `text-base text-text-primary` | Artist/festival name in a card or list item. Override color via `className` (e.g. `text-accent` when now-playing). |

---

### Badge (`Badge.tsx`)

`<Badge variant="...">` — small uppercase pill span.

| Variant | Style | Use for |
|---|---|---|
| `live` | Red fill, white text | LIVE label (live-streamed sets only — distinct from "now playing") |
| `accent` | Lime fill, dark text | NOW time badge in timetable ruler |
| `accent-outline` | Lime border, lime text | Accent pill without fill |
| `outline` | Grey border, secondary text | Generic info pill |
| `conflict` | `text-conflict`, no background | CLASH label in list cards and timetable blocks |

---

### Input / Label (`Input.tsx`, `Label.tsx`)

Standard form fields. `Label` is for field captions only — not for general body text labels.

---

### BottomSheet (`src/components/common/BottomSheet.tsx`)

Shell for all sheet UI — backdrop, slide-up animation, swipe-to-dismiss, Escape key, scroll lock. Accept either a `title` string (renders as `Heading variant="sheet"`) or `headerContent` (arbitrary ReactNode, displayed flex-1 beside the close button).

Close button uses `<Button variant="icon">`.

---

## Set block state system

Applies to both timetable blocks (`TimetableSetBlock`) and list cards (`SetCard`). Identical visual language, adapted to the available pixel area.

| State | Treatment |
|---|---|
| Default | `--color-surface-raised` background, `--color-border-subtle` border |
| Going | Accent left border, `color-mix(accent 12%, surface)` tint |
| Conflict | Orange left border, `color-mix(conflict 12%, surface)` tint, diagonal hazard stripe across top, `CLASH` badge (bottom-right in timetable, inline in list subtitle) |
| Going + conflict | Conflict styling takes priority over going |
| Now playing | Accent border all sides, `color-mix(accent 17%, surface)` tint, `animate-pulse-glow` animation, white artist name, "ENDS IN N MIN" countdown |
| Past | `opacity: 0.4` |

**Conflict hazard stripe:** `repeating-linear-gradient(135deg, var(--color-conflict) 0 7px, var(--color-surface) 7px 14px)`, `h-1.5` bar pinned to the top edge. When present, the block gets `pt-3` (up from `py-1.5`) to push content below the stripe, and absolute-positioned action buttons shift to `top-3`.

**`animate-pulse-glow`:** `pulse-glow` keyframe, 2.6s ease-in-out infinite. Disabled under `prefers-reduced-motion`.

**`--shadow-now`:** Used on list-view now-playing cards (`box-shadow` inline style). Not used in timetable blocks (border glow is the signal there).

---

## Action buttons

`SetActions` component (`src/components/actions/SetActions.tsx`) — shared by SetCard and SetSheet.

Three buttons in a `gap-px` row:
1. **Going** — `icon-toggle`, checkmark/plus SVG
2. **Rating up** — `icon-toggle`, thumb-up SVG (lime fill when active)
3. **Rating down** — `danger`, thumb-down SVG (red fill when active)

All three are auth-gated: anonymous tap opens the sign-up sheet instead of mutating.

In **timetable blocks**, the same three buttons are rendered as raw `w-5 h-5` styled `<button>` elements (not `<Button>` primitives — the timetable's `icon` size is 20px, not the standard 32px). Visibility thresholds:
- Going button: block width > 80px and height ≥ 28px
- Rating buttons: block width > 120px and height ≥ 28px

**Reserved for 2nd interest tier:** The action row in SetActions has a comment reserving the slot for a future "must-see" tier that slots in at the start of the row without reflowing anything — `SetActions` is `shrink-0` and the title is `flex-1 min-w-0 truncate`.

---

## Timetable layout constants

Defined at the top of `TimetableGrid.tsx`:

| Constant | Value | Meaning |
|---|---|---|
| `RULER_H` | 30px | Time ruler row height |
| `LABEL_W` | 88px | Stage label column width |
| `BASE_LANE_H` | 72px | Single-programme lane height |
| `ROW_H` | 36px | Sub-row height when a lane has concurrent sets |
| `LANE_GAP` | 4px | Vertical gap between stage lanes |
| `MIN_PX` | 0.8 | Minimum px-per-minute (zoom out limit) |
| `MAX_PX` | 6 | Maximum px-per-minute (zoom in limit) |

Zoom is controlled by `pxPerMin` state, driven by pinch-to-zoom, ctrl+scroll, and the floating +/- button pair (bottom-right corner of the timetable area, `bg-surface/80 backdrop-blur-sm`).

Dev testing: append `?now=2026-06-06T14:30:00%2B02:00` to the URL to anchor "now" to a festival timeslot and verify live/past states.

---

## Cursor convention

Global rule in `index.css`:
```css
button, [role="button"], a, summary, select { cursor: pointer; }
```
Tailwind's preflight does not set `cursor: pointer` on `<button>` in v4 — this rule covers all interactive elements app-wide.

---

## Atmosphere (procedural fog)

Implemented in `src/components/common/Atmosphere.tsx` and `src/index.css` (`.atmosphere` class). Currently **disabled** in `SchedulePage` (perf evaluation). Component and CSS kept for later activation.

Approach: CSS keyframe animation of layered divs with blend modes — no canvas, no Lottie. Fully cut under `prefers-reduced-motion`. Pause when offscreen.
