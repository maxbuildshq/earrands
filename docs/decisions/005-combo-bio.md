# 005 — resolveBios() display priority (combo vs individual bios)

**Decision:** `resolveBios()` in `SetSheet.tsx` applies this priority:

1. Combo bio first — if a `set_artists` entry has `name` matching `set.artist_name` and has a bio, show it first
2. Individual bios below in named sections (`── ARTIST NAME ──` separators)
3. Artists without bios are silently skipped (no empty placeholders)

**Why:** Two bio sources exist in the data:
- **Awakenings-style**: individual bio per artist fetched from separate artist pages
- **Dekmantel-style**: one combo bio per timeslot describing the collaboration as a whole

A single display function handles both by checking for a combo-named entry first.

| Scenario | Example | Display |
|---|---|---|
| Individual bios only | M-high & Sidney Charles | Two stacked sections |
| Combo bio only | Blasha & Allatt | Single combo bio |
| Combo + some individual | Ben UFO & Call Super & Objekt & Pariah | Combo bio, then individual sections |
| Partial data | Benja & Franc Fala | Only Franc Fala's bio shown |

**How to apply:** When adding new festival data, expect per-artist bios, one combo bio on the set name, or a mix. `resolveBios()` handles all cases — don't write special-case display logic per festival. In the ingest pipeline, combo bios are stored as an artist entry with `name = set.artist_name` and `billing_order: 0`.
