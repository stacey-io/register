# Abuse policy

stacey.io hosts community subdomains. We remove abusive registrations fast.

## What counts as abuse
Phishing or credential harvesting; brand impersonation; malware, unwanted
software, or drive-by downloads; scams and fraud; CSAM (reported to
authorities immediately); spam infrastructure; copyright/trademark
infringement (include proof of ownership); anything illegal in the US.

**Security vulnerabilities are different** — those go to
[SECURITY.md](SECURITY.md) / security@stacey.io, not the abuse queue.

## How to report
Open an issue using the **report-abuse** template with the subdomain and
evidence (URL, screenshot, what it does). No account? Email abuse@stacey.io.

## What happens, and how fast
- **Kill switch within 24 hours** of a verified report (usually much faster) —
  the subdomain's assistant is disabled and reserved-blackholing can be applied.
- Registry record removed via PR; repeat offenders banned from registration.
- Google Safe Browsing status for stacey.io is checked weekly; any flag is
  treated as a P0.

## Automated defenses (so most abuse never lands)
CI rejects reserved, brand-impersonating, and phishing-pattern names and
disallowed CNAME targets; an AI triage bot plus a human review every PR;
live targets are re-probed weekly and dead ones auto-killed.

## Exit guarantee
The registry is public data in this repo. If stacey.io ever shuts down,
every tenant can export their record and point their DNS elsewhere — your
name's history is never locked in.
