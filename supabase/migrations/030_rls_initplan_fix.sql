-- Fix auth_rls_initplan performance warnings.
-- Wrapping auth.uid() in (select ...) prevents per-row re-evaluation,
-- which matters at scale (100K+ users doing owner-scoped queries).

-- user_plans: select_own, insert_own, delete_own
DROP POLICY IF EXISTS select_own ON user_plans;
CREATE POLICY select_own ON user_plans FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS insert_own ON user_plans;
CREATE POLICY insert_own ON user_plans FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS delete_own ON user_plans;
CREATE POLICY delete_own ON user_plans FOR DELETE USING ((select auth.uid()) = user_id);

-- user_ratings: select_own, insert_own, update_own, delete_own
DROP POLICY IF EXISTS select_own ON user_ratings;
CREATE POLICY select_own ON user_ratings FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS insert_own ON user_ratings;
CREATE POLICY insert_own ON user_ratings FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS update_own ON user_ratings;
CREATE POLICY update_own ON user_ratings FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS delete_own ON user_ratings;
CREATE POLICY delete_own ON user_ratings FOR DELETE USING ((select auth.uid()) = user_id);

-- festival_follows: select_own, insert_own, delete_own
DROP POLICY IF EXISTS select_own ON festival_follows;
CREATE POLICY select_own ON festival_follows FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS insert_own ON festival_follows;
CREATE POLICY insert_own ON festival_follows FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS delete_own ON festival_follows;
CREATE POLICY delete_own ON festival_follows FOR DELETE USING ((select auth.uid()) = user_id);

-- festival_requests: select_own, insert_own
DROP POLICY IF EXISTS select_own ON festival_requests;
CREATE POLICY select_own ON festival_requests FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS insert_own ON festival_requests;
CREATE POLICY insert_own ON festival_requests FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- shared_schedules: insert_own, update_own
DROP POLICY IF EXISTS insert_own ON shared_schedules;
CREATE POLICY insert_own ON shared_schedules FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS update_own ON shared_schedules;
CREATE POLICY update_own ON shared_schedules FOR UPDATE USING ((select auth.uid()) = user_id);
