-- Phase 1c (ADR 011): persist the full image-candidate set and per-field
-- enrichment confidence. Both nullable + additive — existing rows, winners
-- (image_url), and enrichment_status are untouched.

alter table artists add column if not exists image_candidates jsonb;
alter table artists add column if not exists enrichment_confidence jsonb;

comment on column artists.image_candidates is
  'All image candidates from every source, confidence-tagged, never excluded: [{ url, source, score, confidence, person_detected, ... }] — image_url stays the reviewed winner';
comment on column artists.enrichment_confidence is
  'Per-field confidence with evidence trail: { <field>: { level: high|medium|low, evidence: string[] } } (ADR 011)';
