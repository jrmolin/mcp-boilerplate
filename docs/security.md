## Security / dependency audit notes

### Current `npm audit` status

`npm audit` may report **moderate advisories** for:

- `ai` (Vercel AI SDK) — filetype whitelist bypass when uploading files
- `jsondiffpatch` — XSS in `HtmlFormatter`

In this repo these appear as **transitive devDependencies** via:
- `@stripe/agent-toolkit` → `agents` → `ai` → `jsondiffpatch`

### Reachability assessment (this worker)

As of the current codebase:

- The worker **does not implement file uploads**, and the server/runtime code does **not import** `ai` directly.
- The reported `jsondiffpatch` issue is in an **HTML formatter** intended for browser rendering. This worker does not use `jsondiffpatch` APIs or render its HTML output.

Therefore, the advisory is currently assessed as **not reachable in our runtime path** (low practical risk), but it is still tracked and should be revisited when upstream fixes are released.

### Mitigations / hygiene

- Keep dependencies updated (`npm audit fix` when available).
- Avoid introducing any code path that uses the vulnerable formatter (e.g. `jsondiffpatch` HTML output) until fixed.
- If/when upstream fixes exist, upgrade `agents` / `@stripe/agent-toolkit` accordingly.

### Notes on other advisories

We pin `undici` via `package.json` `overrides` to keep the version used by Wrangler/Miniflare on a patched release.

