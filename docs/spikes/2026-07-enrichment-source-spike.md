# Phase 0 Spike — Enrichment Source Evaluation (2026-07-13)

Go/no-go findings per candidate source for the multi-source entity-resolution pipeline.
Empirical test: 29 human-reviewed artists (ground truth), spanning 898k → <400 SC followers,
techno + dnb. Test script + raw JSON preserved in session scratchpad; methodology: name search
per source, compare returned URL relations against reviewed `soundcloud_url` / `instagram_url` /
`bandcamp_url` / `discogs_id`.

## Verdicts

| Source | Verdict | One-liner |
|---|---|---|
| MusicBrainz | **GO** (corroboration node only) | Core data incl. URL relations is CC0 — commercially clean. Excellent cross-link agreement for established artists; useless-to-dangerous for obscure ones. |
| Wikidata | **NO-GO** | License clean (CC0) but name search has a high wrong-entity rate and adds nothing MB doesn't already link to. |
| Spotify API | **NO-GO** (decision 2026-07-13: skip entirely, incl. link-only field) | Developer Policy requires link-back + Spotify-marks attribution and prohibits standalone metadata / database building. Boss decided against even a `spotify_url` link field; revisit only if a product need appears. |
| Image hotlinking | **GO** (status quo holds) | `i1.sndcdn.com` + `i.discogs.com` serve 200 with no/foreign referer; a 13-month-old signed Discogs URL still resolves. |
| Visual similarity (Workers AI) | **PIVOT** | No CLIP-class embedding model on Workers AI. Instead: VLM same-person check (`llava-1.5-7b-hf` / `llama-3.2-11b-vision` / moondream) — one API call, same integration shape as the existing DETR scorer, fits the free 10k neurons/day. |

## MusicBrainz — detail

**License**: core data (artist entities, aliases, URL relationships — everything we need) is
**CC0/public domain**; commercial use unrestricted. The CC-BY-NC-SA restriction applies only to
supplementary data (tags, ratings, annotations) and the Live Data Feed replication service —
neither needed. Constraints: 1 req/s, meaningful `User-Agent` required.

**Empirical (29 artists)**:
- Entity found: 25/29. SC URL corroborated: 16/29 (**10/10 for the popular tier**),
  IG corroborated: 15/29. 2 found entities carried zero URL relations (no evidence
  either way). Wrong entities: 3 (Ruthless → Dutch hardstyle DJ; Savannah → unrelated
  Dutch act; See No Evil → URL-less entity) — all sub-500-follower artists, and all
  harmless under agreement semantics: a wrong entity links the wrong socials, so it
  corroborates nothing and contributes zero evidence (it can confirm, never poison).
- Discogs ID corroborated wherever the entity was right (MB often lists multiple Discogs IDs
  per artist — match must be any-of, not first).
- MB routinely carries SC + IG + Bandcamp + Discogs + Spotify + artist-website URLs on one
  entity — a single lookup can corroborate the entire link set at once. Also links Wikidata,
  making a separate Wikidata integration redundant.
- **Search score is useless for disambiguation**: wrong entities also scored 100
  ("Ruthless" → Dutch hardstyle DJ instead of the UK MC; "Savannah" → unrelated Dutch act;
  "See No Evil" → entity with zero URLs). Confirms the plan's core thesis: identity =
  URL cross-link agreement, never name-match score.
- Obscure artists (<500 followers): mostly absent or wrong — but these fail on every
  encyclopedic source; their path remains Brave→SC. MB's value is corroborating the
  established tier cheaply and safely.

**Integration**: `musicbrainz.ts` resolver = 2 requests/artist (search + url-rels lookup),
contributes *evidence edges* to the agreement graph. Never a sole source for any field.
**No API key exists or is needed** — MB's web service is open; the only requirements are a
meaningful `User-Agent` and ≤1 req/s, both enforced in the resolver.
**Nothing from MB is stored**: evidence is held in memory during the run; what persists is
our own `field_confidence` levels plus human-readable evidence strings (e.g. "musicbrainz
entity links same SoundCloud") in the review JSON — no MB IDs, URLs, or payloads in the DB.

## Wikidata — detail

CC0, but `wbsearchentities` by name returned wrong entities for 4 of 15 hits
(Andy C → Andy Cohen the talk-show host; BIIA → an American rock musician;
Makoto → a Japanese wrestler; DJ Ron → a mismatched Discogs ID) and found none of
the obscure artists. The correct entities are
reachable via MB's wikidata relation if ever needed. Not worth a resolver.

## Spotify — detail

What the plan asked for: ToS verdict on display/caching/mixing, rate limits, field inventory
(images, followers, popularity, genres), then guided dev-app setup. Findings:

**Field inventory (client-credentials flow, no user auth)**: `GET /v1/search?type=artist` +
`GET /v1/artists/{id}` return exactly what we'd want — `images[]` (multiple sizes),
`followers.total`, `popularity` (0–100), `genres[]`, plus the artist page URL. Technically
this is the richest single source evaluated.

**Rate limits**: not published as fixed numbers — a dynamic rolling ~30s window; on
exceeding it the API returns 429 with `Retry-After`. Fine for our volumes; not the blocker.

**Developer Policy — the blocker** (developer.spotify.com/policy):
- Metadata/cover art "must be accompanied by a link back to the applicable … content on the
  Spotify Service", attributed "using the Spotify Marks" — i.e. every artist image/stat shown
  would need a Spotify-branded link next to it in our UI.
- Must not offer metadata "as a standalone service" — using their metadata to enrich our own
  artist database, displayed without the underlying Spotify content, is exactly this.
- Storage limited to what's necessary to provide the app, with deletion obligations;
  building a music database from Spotify content is restricted.
- Mixing/integrating with content from other services is restricted — our whole model is
  multi-source aggregation.

Verdict: nearly every clause points against our use pattern. This isn't a grey area worth
chip-scale legal exposure when SC avatars + Discogs cover images and SC followers already
serve as the popularity signal. **The planned guided dev-app setup is moot — no Spotify
developer app will be created.**

**Considered fallback, then rejected (2026-07-13)**: MB url-rels expose
`open.spotify.com/artist/…` links for most established artists, so a `spotify_url` link
field would have cost zero API integration and zero ToS exposure. Boss decided to skip
Spotify entirely, including the link field; revisit only on a concrete product need.

## Visual similarity — detail

Workers AI model catalog has no image-embedding (CLIP) model. Pivot: send festival reference
photo + candidate image to a vision LLM with a "same person?" prompt → boolean + brief reason,
used exactly as planned (admin-side wrong-person warning, never a gate, never user-facing).
Same REST shape as the current `image-scorer.ts` DETR call. Pricing: neurons;
10k/day free ≈ hundreds of checks/day. Verify quality on ~10 known pairs during Phase 1
implementation before wiring it into the queue UI.
