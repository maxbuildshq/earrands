# 002 — Always use T12:00:00 when constructing Date from date strings

**Decision:** When building a `Date` object from a `YYYY-MM-DD` string, always append `T12:00:00`: `new Date('2024-06-15T12:00:00')`.

**Why:** `new Date('2024-06-15')` is parsed as UTC midnight and immediately becomes the previous day in negative-offset timezones (e.g., EU/US). Using noon prevents this shift across all timezones.

**How to apply:** Any place that constructs a Date from a festival date string must use noon. Utility functions in `src/lib/dates.ts` already do this — don't bypass them with raw `new Date(dateString)`.
