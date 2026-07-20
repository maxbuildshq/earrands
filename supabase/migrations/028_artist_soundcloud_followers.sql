-- SoundCloud follower count — popularity signal for ranking artists (e.g. emphasizing
-- headliners in shared schedule images). Read from the same __sc_hydration JSON as
-- city/country_code during enrichment. Nullable; refreshed via `enrich --fields=followers`.
alter table artists add column if not exists soundcloud_followers integer;
