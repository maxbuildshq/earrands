# 001 — text-secondary is white, not grey

**Decision:** `--color-text-secondary: #FFFFFF` (white), not a grey tone.

**Why:** Festival app users are outdoors in direct sunlight with screens at max brightness. Grey text becomes invisible against dark surfaces in those conditions. White ensures readability in the worst-case environment.

**How to apply:** Never "fix" text-secondary to grey for aesthetic reasons. Any label, timestamp, or secondary element using `text-text-secondary` stays white. Only `text-primary` (`#E5E5E5`) is slightly dimmed.
