# Security

## Reporting
Email **security@stacey.io** (see also https://stacey.io/.well-known/security.txt).
Please do not open public issues for vulnerabilities. Target response: 72h.

## How keys and data are handled
- Tenant AI keys are stored **AES-GCM-256 encrypted at rest** in Cloudflare KV;
  only the last 4 characters are ever displayed. Keys are never sent to browsers.
- The GitHub OAuth token used to open your registration PR is **deleted the
  moment the PR is created** — it is not retained for the session.
- Visitor chats are proxied through the stacey.io worker to the tenant's AI
  provider; see https://stacey.io/privacy.html.

## Scope
`stacey.io`, `api.stacey.io`, the registration pipeline in this repo, and the
embeddable widget. Subdomain *content* is tenant-controlled — report abusive
sites via the report-abuse issue template instead.
