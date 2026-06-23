---
name: parsing-hospitality-app
description: >
  Scrape Hospitality on the Beach 2026 festival timetable from the iOS companion app
  running on macOS, extracting sets, bios, and socials (IG + SC only) for every day/stage.
  Produces three output files in scraped/. Uses computer-use MCP to drive the app.
---

# Parsing Hospitality App — Skill Spec

## Goal

Extract the full timetable + artist extras (bios, Instagram, SoundCloud) from the
"Hospitality" iOS companion app running on the user's Mac. Produce three files that
drop straight into the earrands ingest pipeline.

## Prerequisites

- The Hospitality app is open on the Mac.
- `computer-use` MCP is available. Call `request_access` for the app before anything else.
- Wednesday (2026-07-01) data is **already done** — files exist in `scraped/`. Resume from **Thursday (2026-07-02)**.

## Output files

| File | Format | Purpose |
|---|---|---|
| `scraped/hospitality-on-the-beach-2026.json` | `ScrapedData` | Festival + stages + all sets |
| `scraped/hospitality-on-the-beach-2026-extras.json` | `{ sets: [...] }` | Bios + socials keyed by set |
| `scraped/hospitality-on-the-beach-2026-nonmusical.json` | `{ festival_slug, events: [...] }` | Yoga/wellness/run club etc. |

Template for ScrapedData shape: `scraped/dekmantel-2026.json`.

## Incremental persistence (CRITICAL)

Context compression **will** happen during long scraping runs. To survive it:

1. **Progress tracker** — `scraped/.hospitality-progress.json`:
   ```json
   {
     "current_day": "2026-07-03",
     "current_stage": "Beach Stage - Virus X Darkshire",
     "current_set_index": 4,
     "days_completed": ["2026-07-01", "2026-07-02"],
     "stages_completed_today": ["Garden Stage - Hospitality"],
     "last_updated": "2026-06-22T14:30:00Z"
   }
   ```
   Update this after **every set** is fully processed.

2. **Per-day scratch files** — `scraped/.hospitality-day-YYYY-MM-DD.json`:
   ```json
   {
     "day": "2026-07-02",
     "sets": [ /* same shape as final scraped file sets */ ],
     "extras": [ /* same shape as extras file entries */ ],
     "nonmusical": [ /* if any */ ],
     "stages_found": ["Garden Stage - Hospitality", "..."]
   }
   ```
   Append to this after each set. On resume, read this file to know what's already captured.

3. **Resume protocol**: On start (or after context compression), read the progress file,
   read the current day's scratch file, and continue from where you left off. Never
   re-scrape a set that's already in the scratch file.

4. **Final assembly**: Once all days are done, merge all scratch files into the three
   output files, preserving Wednesday data already in the existing files.

## App navigation rules

### View mode
- Use **List view** (vertical, shows times). The app has a List/Blocks toggle near the
  day selector area.
- **NEVER accidentally switch to Blocks view.** This resets scroll position and wastes time.

### Click zones — HARD RULES
- **Top 55% of screen**: Safe zone for clicking on sets/acts. All set clicks MUST happen here.
- **Bottom 45% of screen**: BANNED for clicking, with ONE exception: the day selector
  (WED/THU/FRI/SAT/SUN tabs).
- Before clicking a set, **scroll it well into the safe zone** (upper half of screen).
  The set should be comfortably between the header and the 55% line.
- The Blocks/List toggle sits near the day selector. Misclicking it resets your scroll
  and forces re-scrolling. This has happened repeatedly — avoid at all costs.

### Scrolling
- Scroll **inside the phone-sized window** using the window's coordinates.
- **Scroll 1.65x further than feels natural.** Always overshoot the scroll distance by
  this factor to save time — it's faster to scroll back up slightly than to issue many
  small scrolls.
- After scrolling, take a screenshot to verify position before clicking.
- When switching stages, the view may reset to top — expected behavior.

## Per-set extraction procedure

For **every set** on **every stage** on **every day**:

1. Scroll the set into the safe zone (top 55%).
2. Click the set to open the ACT sheet.
3. Scroll the ACT sheet **all the way to the bottom** — bios and social icons are at the
   bottom and easy to miss. Some artists have no bio; some have long multi-paragraph bios.
   You must scroll to verify.
4. Capture:
   - **Full title** (as shown on the ACT sheet header)
   - **Bio**: if present, capture the entire text blob as-is. Don't split multi-artist bios.
   - **Socials (Instagram + SoundCloud ONLY)**: The social icons have no labels.
     Click the IG icon → in-app webview opens → read the URL from the address bar → go back.
     Same for SC. Skip Spotify/website/other icons.
     If the act has multiple artists with separate social sections, capture per-artist.
5. Go back to the list view.
6. **Write the set data to the scratch file immediately.**
7. Update the progress tracker.

## Stage & day iteration

- Days: WED (07-01, already done) → THU (07-02) → FRI (07-03) → SAT (07-04) → SUN (07-05)
- Stages per day: read from the stage header tabs in the app. They change daily
  (different promoters host different stages on different days).
- For each day, iterate through ALL stages left→right.
- **No check-in after each stage.** Move directly from stage to stage within a day
  without pausing for confirmation. Checkpoint only happens once per **whole day**
  (see Checkpoint protocol below).

## Data conventions

- `stage`: verbatim from app including brand suffix (e.g. `"Garden Stage - Hospitality"`)
- `artist_name`: raw, exactly as shown. Keep `B2B`, `&`, `x`, `vs`, `presents`, `hosted by`.
- Times: `HH:MM` format.
- `is_live`: true only if app explicitly labels a live PA.
- Cross-midnight: sets after midnight belong to the **opening festival day** (app's grouping).
- TBA: flag to user, don't ingest.
- Non-musical events (yoga, wellness, sound bath, run club): skip from main file, capture
  in the nonmusical scratch/output.

## Checkpoint protocol

After each day is fully scraped:
1. Present a summary table to the user: stages found, set count per stage, notable finds
   (bios, socials, non-musical events).
2. Wait for user confirmation before moving to the next day.
3. Note any discrepancies or unexpected findings.

## Error recovery

- If the app crashes or becomes unresponsive: take a screenshot, report to user.
- If a social link click leads to an error page: record `null` for that URL, note the issue.
- If you can't read a bio (text cut off, etc.): zoom in on the region, retry.
- If you accidentally switch to Blocks view: switch back to List, re-scroll to where you
  were (check progress tracker for last completed set).
