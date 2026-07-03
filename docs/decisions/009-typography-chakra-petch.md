# 009 — Typography: Chakra Petch

**Status:** Accepted (UX revamp, Phase 0).

**Decision:** Replace the previous type system (Space Mono headers + Barlow Condensed body) with a single family, **Chakra Petch**, used app-wide for both display and body.

## Why

The revamp introduces dense, information-heavy surfaces (the swimlane timetable: stage labels, long b2b artist names, times packed into narrow lanes). Space Mono is characterful but monospaced — it taxes readability when scanning many long names, which is the dominant action in a schedule. The rave/techno print tradition is built on **stark grotesques** (Akzidenz/Helvetica lineage — Factory Records, Berghain) often paired with a mono for technical data; RA Guide likewise prioritises a readable grotesque.

Chakra Petch is a squared techno grotesk: it keeps an underground, mechanical, "designed" character that fits the brand (it would not look out of place on a flyer) while being markedly more legible than Space Mono for artist/stage names. A single family also simplifies the system and keeps the bundle lean ([008](008-ios-migration-app-size.md)).

Candidates also evaluated: Space Grotesk + IBM Plex Mono (keeps "Space" DNA), Archivo (most ergonomic, true condensed cuts). Chakra Petch was chosen for the best balance of techno character and readability.

## How to apply

- Self-hosted via `@fontsource/chakra-petch`, weights **400 / 500 / 600 / 700** only (Latin subset) — do not pull the full family or other weights ([008](008-ios-migration-app-size.md) size discipline).
- The Tailwind `@theme` tokens `--font-mono` and `--font-condensed` both point at `"Chakra Petch"`, so existing `font-mono` / `font-condensed` utility classes pick it up without per-component changes. The token *names* are retained only to avoid a mass refactor — they no longer imply monospace/condensed.
- Accent (acid lime `#CCFF00`) and the rest of the palette are unchanged; only the typeface moved.

## Addendum — share-image exports use Anton for display type

The schedule share posters (`src/lib/shareImage.ts`) are the one exception to "Chakra Petch app-wide". At poster sizes Chakra Petch is too wide — long b2b names wrap and fewer sets fit per image. Exports use **Anton** (`@fontsource/anton`, single 400 weight, loaded only by `ShareScheduleSheet`) for the festival title, set names, and page number; all meta text (subtitle, day labels, times, footer) stays Chakra Petch. This applies to exported images only — never to app UI. `DISPLAY_FONT` in `shareImage.ts` is the single switch.
