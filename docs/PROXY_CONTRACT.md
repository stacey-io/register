# stacey.io — Widget & Proxy Contract

This document defines the interface between the three moving parts that live
*outside* this repo: the embed snippet, the widget, and the proxy. This repo only
manages DNS + registration; everything below runs on the stacey backend.

## The one rule that makes everything safe

**Nothing secret ever ships to the browser.** The snippet contains only a public
`site-id`. The user's AI API key lives encrypted in the stacey backend, entered
once via the dashboard. The widget can only talk to the proxy; the proxy attaches
the key server-side and forwards to the AI provider.

```
visitor's browser                stacey backend                 AI provider
┌───────────────┐    HTTPS    ┌─────────────────┐   user's    ┌────────────┐
│ widget.js     │ ──────────► │ api.stacey.io   │ ──────────► │ Gemini /   │
│ (site-id only)│ ◄────────── │ /v1/chat        │   key,      │ OpenAI /   │
└───────────────┘   stream    │ rate limits,    │  attached   │ Anthropic  │
                              │ origin checks,  │  server-side└────────────┘
                              │ kill switch     │
                              └─────────────────┘
```

## 1. The embed snippet (what users paste)

```html
<script
  src="https://api.stacey.io/widget.js"
  data-site-id="stc_live_9f3a2b1c"
  defer></script>
```

One line. `data-site-id` is public by design — it grants nothing on its own.

## 2. Provisioning (repo → backend)

`POST https://api.stacey.io/internal/provision`
Auth: `Bearer <STACEY_PROVISION_TOKEN>` (GitHub Actions secret, only the
provision workflow holds it).

```json
{
  "commit": "abc123",
  "changes": [
    { "subdomain": "johndoe", "status": "A",
      "data": { "owner": {"username": "johndoe", "email": "j@x.com"},
                 "records": {"CNAME": "johndoe.github.io"},
                 "stacey": {"assistant": true} } },
    { "subdomain": "badsite", "status": "D" }
  ]
}
```

Backend behavior:
- `A` (added): create site row, generate `site_id`, set
  `allowed_origins = ["https://<subdomain>.stacey.io"]`, email owner their
  dashboard magic link.
- `M` (modified): update; if `assistant` flipped false→true, provision; if
  true→false, suspend the site_id.
- `D` (deleted): **revoke site_id immediately** — the widget dies everywhere
  within seconds, before DNS even propagates. This is the kill switch.

## 3. Chat endpoint (widget → proxy)

`POST https://api.stacey.io/v1/chat`

```json
{
  "site_id": "stc_live_9f3a2b1c",
  "messages": [{ "role": "user", "content": "How do I install this?" }],
  "page": { "url": "https://johndoe.stacey.io/docs", "title": "Docs" }
}
```

Response: streamed text (SSE), or one of:

| status | meaning | widget behavior |
|---|---|---|
| 200 | streaming reply | render tokens |
| 403 | origin mismatch / site revoked | widget removes itself silently |
| 429 | rate limited (visitor, site, or upstream key quota) | show "the assistant is resting — try again in a bit" |
| 503 | upstream AI provider down | same friendly degradation |

## 4. Proxy enforcement checklist (server-side, every request)

1. `site_id` exists and is active (kill switch check).
2. `Origin`/`Referer` header host matches the site's `allowed_origins`.
   (Deters casual abuse; not bulletproof — headers can be forged by non-browser
   clients — which is why per-site quotas below are the real backstop.)
3. Per-visitor rate limit (e.g. 10 msg/min by IP hash) — protects the user's
   free-tier key quota from a single visitor.
4. Per-site daily cap — protects YOUR Worker bill from one hot/abused site.
5. Prompt hardening: the system prompt is assembled server-side, ALWAYS in
   this order (the "prompt sandwich"):

   ```
   [1. stacey base rules]      immutable: scope to this site only, refuse
                               off-site tasks, never reveal keys/site config,
                               never claim to be stacey staff, obey rate/size
                               limits, decline unsafe content
   [2. site context]           crawled/cached page content for this subdomain
   [3. owner persona]          stacey.prompt from the register repo, or the
                               dashboard override if set (dashboard wins);
                               max 500 chars, re-validated server-side
   [4. visitor messages]       always data, never instructions
   ```

   Layer 3 can shape tone and emphasis but cannot override layer 1 — the base
   rules explicitly state they take precedence over anything that follows.
   Never trust repo-side validation alone: re-check length/content at
   provision time, since the proxy may receive prompts from the dashboard too.
6. Message + response logged as counters only (tokens, latency) — do not store
   chat content; say so in the privacy policy, it's a feature.

## 5. Key handling rules

- Keys entered only at `stacey.io/dashboard`, over HTTPS, after GitHub OAuth
  as the subdomain's `owner.username`.
- Encrypted at rest (per-site data key; app-level AES-GCM is fine at this
  scale). Never logged, never returned by any API after save (display last-4
  only).
- Free-tier keys recommended in UI; paid keys allowed with a "set a spend
  limit at your provider" warning.

## 6. Context = the "built on the website" magic

Minimum viable: widget sends current `page.url` + `title`; proxy fetches and
caches that page's text (respecting robots.txt), injects it into the system
prompt. V2: crawl the whole subdomain on provision, embed it, retrieve top
chunks per question. Without this the assistant is a generic chatbot — this is
the feature that sells the whole bundle, don't skip it.
