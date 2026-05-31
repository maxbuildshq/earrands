# 007 — Marketing consent checkbox must be unchecked by default

**Decision:** The "Email me occasional updates" checkbox on `SignUpPage` is unchecked by default and must remain so.

**Why:** GDPR requires explicit opt-in for marketing communications. A pre-checked box does not constitute valid consent under EU law.

**How to apply:**

- Never default the checkbox to checked, for any reason
- Consent value (`marketing_consent`, `marketing_consent_at`) is stored in `user.user_metadata` via Supabase Auth `signUp` options
- Service emails (timetable-drop, request-matched notifications) do NOT require this checkbox — the follow/request action itself is the consent for those
