-- These tables are managed by edge functions via service_role key.
-- RLS is on but had no policies, which silently blocks all access (correct behavior).
-- Adding explicit deny-all policies makes the intent visible and prevents
-- accidental exposure if a permissive policy were added later.

CREATE POLICY service_role_only ON enrichment_jobs FOR ALL USING (false);
CREATE POLICY service_role_only ON notification_log FOR ALL USING (false);
CREATE POLICY service_role_only ON welcome_emails FOR ALL USING (false);
