<h1 align="center">stacey.io</h1>

<p align="center"><strong>stacey.io</strong> gives your project a free <code>.stacey.io</code> subdomain <em>plus</em> a drop-in AI chat assistant — one JSON file, one script tag, done.</p>

---

## ✏️ Register

**Easiest way:** use the UI at [stacey.io](https://stacey.io) — check availability, log in with GitHub, and we open the PR *from your account* automatically.

**Manual way:**

1. **Fork** this repository.
2. Copy `example.json` to `domains/<your-subdomain>.json` and edit it.
   Set `"stacey": { "assistant": true }` if you want the AI widget.
3. Open a **pull request**. CI validates it automatically; a maintainer reviews it.
4. On merge:
   - your DNS goes live within minutes,
   - if you enabled the assistant, you'll get a **dashboard link by email** — add
     your AI API key there (a free-tier key works!), then paste this into your site:

```html
<script src="https://api.stacey.io/widget.js" data-site-id="YOUR_SITE_ID" defer></script>
```

That's it. A chat assistant that knows your site appears bottom-right.

> ⚠️ **Never put your API key in this repository.** This repo is public and
> scraped by bots constantly. Keys go in the dashboard only — CI will
> automatically reject any PR that contains something that looks like a key.

## 📄 Domain file format

```json
{
    "owner": {
        "username": "your-github-username",
        "email": "you@example.com"
    },
    "records": {
        "CNAME": "your-github-username.github.io"
    },
    "proxied": false,
    "stacey": {
        "assistant": true,
        "prompt": "You are my project's assistant. Keep answers short and casual, and link to the docs when relevant."
    }
}
```

Supported records: `A`, `AAAA`, `CAA`, `CNAME`, `MX`, `TXT`.

`stacey.prompt` (optional, max 500 chars) gives your assistant a persona — tone,
what to emphasize, where to point people. It layers **under** stacey's base
rules (it can't disable safety or rate limits) and this repo is public, so no
secrets in it. You can edit it anytime later from your dashboard without a new PR.

## 📏 The rules (short version)

- Your PR author username must match `owner.username` — you can only touch your own subdomains.
- No reserved names, no tunnel/throwaway CNAME targets, no parked empty domains.
- Dev projects, portfolios, docs, and personal sites — no illegal content,
  phishing, impersonation, or adult content. Full list in the
  [Terms of Service](TERMS_OF_SERVICE.md).
- We reserve the right to deny or revoke any registration for any reason.

## 🤖 AI triage

Every registration PR gets an automated first pass (`triage.yml`): JSON
validation, a reachability check on the target, and an AI risk review for
phishing/impersonation signals. Low-risk PRs get labeled `triage:low-risk`
for one-click merging; anything odd gets `triage:needs-review` with notes.
A human maintainer always makes the final call. (Requires the
`ANTHROPIC_API_KEY` repo secret; the workflow is fork-safe — it never
executes PR code.)

## ⛔ Report abuse

Found a subdomain breaking the rules? [Open an abuse report](../../issues/new?template=report-abuse.md&labels=report-abuse). Assistant abuse gets the widget killed instantly; DNS removal follows.

## 🔍 What's public and what isn't

This repo — the registry data, the rules, CI, and the DNS pipeline — is and
stays public: you can see every registered subdomain, every pending PR, and
report abuse on any of them. The assistant backend (key vault, chat proxy,
dashboard) is closed-source and holds no registry data of its own; this repo
remains the source of truth for who owns what.

## 📜 License

MIT — see [LICENSE](LICENSE) for full terms and third-party attributions.
