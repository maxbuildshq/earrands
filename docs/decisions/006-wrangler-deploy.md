# 006 — Use `npx wrangler deploy`, not `wrangler pages deploy`

**Decision:** Deploy command is `npx wrangler deploy` via `wrangler.toml` with `[assets]` block.

**Why:** Using `wrangler pages deploy` causes auth errors. Using the `[assets]` block in `wrangler.toml` with `wrangler pages deploy` causes a "does not support assets" error. The Workers static assets approach (`[assets]` + `wrangler deploy`) works correctly.

```toml
# wrangler.toml
name = "festival-pulse"
compatibility_date = "2026-05-24"

[assets]
directory = "./dist"
```

**How to apply:** Always use `npm run deploy` (which internally runs `npx wrangler deploy`). Never run `wrangler pages deploy` directly.
