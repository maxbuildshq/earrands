# 003 — day field is festival day, not calendar day; cutoff = 07:00

**Decision:** The `day` field on `sets` stores the festival programming day — not the calendar date. After-midnight sets (00:30–06:59) belong to the previous festival day.

**Why:** Camping after-parties run until dawn. Users think of "Friday night" as including the 2am–6am sets. The festival day concept matches how attendees plan their schedule.

**How to apply:**

- `AFTER_MIDNIGHT_CUTOFF = '07:00'` in `src/lib/dates.ts` — times before 07:00 are treated as next calendar day for computation
- `toSortableTime()` maps "00:30" → "24:30" so after-midnight sets sort after 23:59
- `toFestivalDate()` in `useNowPlaying.ts` adds 1 day when time < cutoff (so "Friday 00:30" resolves to Saturday 00:30 calendar time)
- An "AFTER MIDNIGHT" divider appears in `SchedulePage` between the last pre-midnight and first after-midnight set
- When ingesting, store after-party sets under the preceding festival day with their actual clock time
