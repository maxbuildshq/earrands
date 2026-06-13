# 008 — iOS/Android migration: app-size strategy

**Status:** Open. Options recorded below; the native path is deferred until iOS work is scheduled. This is a forward-looking record, not a committed decision like 001–007.

**Decision:** Defer the choice of native approach (Capacitor / React Native / native SwiftUI), but commit *now* to the size-discipline principles in **How to apply** — they hold regardless of path, and they are cheap before the migration and expensive to retrofit after.

## Why record this now

iOS is on the roadmap (Android later, lower priority, not guaranteed). Two assumptions tend to wreck app size *before the first line of native code is written*, so we pin them down up front:

1. **"Visually beautiful / technically advanced" ≠ big.** It feels like richer UI means a heavier binary. It doesn't. Visual richness on mobile is the GPU compositor (free, in the OS), vector assets, SF Symbols, procedural gradients/blurs, Lottie/Rive micro-animations, and motion/physics *code* — all tiny on disk. The most beautiful native apps are also among the smallest. Our PWA already proves it: gorgeous-capable and ~sub-MB.
2. **The bloat is choices, not the product.** A "simple-looking" 100MB app is almost always framework floor + an SDK pile + un-curated assets + no size budget — not a requirement the problem imposed.

## Why simple-looking apps reach 100MB+ (the autopsy)

Visual simplicity is a property of the rendered screen; binary size is a property of everything shipped to make it work. They're nearly unrelated. In rough order of impact:

| Cause | Detail |
|---|---|
| **Framework runtime floor** | The biggest lever. Native (SwiftUI/Kotlin): **<10MB** — the OS already has the UI toolkit. Capacitor/Cordova (WebView shell, uses the OS WKWebView, ships **no** browser engine): **~5–15MB**. React Native (Hermes JS engine + RN runtime + bridges): **~15–25MB before your code**. Flutter (ships its *own* Skia/Impeller renderer, draws every pixel itself): **~15–20MB before your code**. |
| **Un-curated assets** | Raster images at @1x/@2x/@3x (3 copies of every illustration); full font families × full glyph sets (a single **CJK font is 5–15MB**); video/GIF onboarding instead of vector; bundled seed DBs / offline content; **on-device ML models** (10–100MB, silently). |
| **The SDK pile** | The #1 *self-inflicted* cause. "Simple" consumer apps routinely embed 10+ SDKs: multiple analytics, crash reporting, attribution (AppsFlyer/Adjust), ads, push, in-app messaging, social logins (the Facebook SDK alone is heavy), maps. Each pulls transitive native deps; nobody ever removes one. |
| **Multi-arch + reporting illusion** | A binary holds machine code per CPU architecture, and the App Store sometimes reports the unsliced size. With **app thinning**, a user downloads only their device's slice — a "100MB app" can be a ~40MB real download. Some of the scary number is reporting, not bytes installed. |
| **Process rot** | No CI size budget → every release adds, none audits → debug symbols leak in, dead code from feature flags accumulates, duplicate dependency versions get linked. Apps ratchet upward because nobody watches the number. |

**Inevitable vs. choices:** the only unavoidable floor is the framework runtime + multi-arch. If you *choose* RN/Flutter, ~15–25MB is the cost of admission. For an app of earrands's complexity, **anything above ~30MB is choices.**

## Where earrands stands

- **Featherweight bundle.** Production deps: React 19, Router v7, React Query v5, Supabase JS, PostHog, two `@fontsource` fonts. Over the wire ≈ sub-MB.
- **Content is streamed, not bundled.** Artist images and timetables come from Supabase and are cached by the Workbox service worker (`vite.config.ts` `runtimeCaching`). A festival app's bulk is inherently dynamic, so it belongs on the network + cache — never in the binary. **This is our structural size advantage and must survive any native migration.**

## The strategic fork (path deferred)

| Path | Reuse | Size | Feel + platform features | Cost |
|---|---|---|---|---|
| **A. Capacitor** (wrap the PWA in WKWebView) | 100% of React code; one codebase web + iOS + Android | ~5–15MB | Decent *if* we add native polish (haptics, native share, safe-area/status-bar handling, offline). Risk: Apple Guideline 4.2 "minimum functionality / is this just a website?" — passable because earrands is a genuine standalone offline tool, but only with that polish. | **Low — ship in weeks** |
| **B. React Native** | Logic concepts; UI rewritten | ~15–25MB | Strong native gestures/animations (Reanimated, Gesture Handler) — good for micro-UX; more native feel than a webview. | High — real rewrite, second codebase |
| **C. Native SwiftUI** | None (rewrite per platform) | <10MB | Best feel + performance, and unlocks festival-killer features impossible/poor in a webview: **Live Activities / Dynamic Island countdown to the next "going-to" set, Lock Screen & Home Screen timetable widgets, StandBy mode, deep haptics, ProMotion scroll.** | Highest — per-platform code |

**The tension to resolve later:** Capacitor keeps us lean and one-codebase and ships now; native unlocks platform features that are genuinely differentiating *for a festival app specifically* (a Lock Screen countdown to your next set is exactly the kind of magic a webview can't do). A common pragmatic sequence is Capacitor-first to validate App Store presence, then go native selectively (native plugins, or a SwiftUI rewrite if traction justifies it) for the few high-value platform features. Not committing here — recording the trade-off.

## How to apply (commit now — path-agnostic)

1. **Set a binary-size budget and gate it in CI** (e.g. iOS install size < 30MB). The single most effective habit; apps balloon because no one watches the number.
2. **Keep assets streamed + SW-cached; never bundle artist images.** Preserve today's architecture.
3. **Audit every SDK before adding it.** We have PostHog + Supabase — resist the attribution/ads/second-analytics pile. Each one is permanent weight; prefer first-party / server-side where possible.
4. **Subset the fonts.** Ship only the Space Mono + Barlow Condensed weights and (Latin) glyphs actually used — easily saves megabytes.
5. **Vector for chrome** (SF Symbols / SVG); raster only for photography. **Lottie/Rive** for the "small UX details" — richness for kilobytes.
6. **Lean on app thinning / on-demand resources** so users fetch only their device slice + assets they actually reach.
7. **One runtime, never two** — don't end up shipping both a WebView and an RN/JS engine.
