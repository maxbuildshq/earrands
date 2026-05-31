# 004 — FeedbackButton sheet must portal to document.body

**Decision:** `FeedbackButton`'s sheet is portalled to `document.body`, not rendered in-place inside `Header`.

**Why:** The header uses `backdrop-filter: blur(...)` for its frosted-glass effect. `backdrop-filter` creates a new CSS containing block, which clips `position: fixed` children to the header's bounding box. Without a portal, the sheet would be trapped inside the header visually.

**How to apply:** Any `position: fixed` overlay (sheet, modal, toast) that lives inside a component with `backdrop-filter` must be portalled out. `BottomSheet` itself does not portal — the caller is responsible for portalling if the parent has `backdrop-filter`.
