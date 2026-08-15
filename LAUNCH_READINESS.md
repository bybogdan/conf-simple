# Launch Readiness

## Status

Overall status: `BLOCKED`

Use only `TODO`, `IN_PROGRESS`, `DONE`, or `BLOCKED` for workstream status. Complete workstreams in dependency order. The engineering MVP remains complete; reopen application code only for the security blocker, branding integration, landing-page implementation, and the permissions-copy correction listed here.

## Launch Goal

Make Conf Simple a credible public MIT-licensed MVP that small software teams can understand, self-host safely, and evaluate through GitHub, a minimal product page, and Product Hunt.

## 1. Product Naming & Positioning

**Status:** `DONE`

- [x] Confirm **Conf Simple** as the final public name. No obvious exact-name software/wiki conflict was found; formal trademark clearance remains outside this launch workflow.
- [x] Finalize one consistent positioning set for all public surfaces:
  - One-line description: “Conf Simple is a lightweight, self-hosted wiki for small software teams to write, organize, and find documentation.”
  - GitHub description: “A lightweight self-hosted wiki for small software teams, built with Node.js, SQLite, and local file storage.”
  - Product Hunt tagline: “A lightweight, self-hosted wiki for small software teams”
  - Hero headline: “Open it. Write documentation. Find it later.”
- [x] Use this final name and positioning consistently across the app, landing page, README, GitHub metadata, and Product Hunt assets.

## 2. Security & Trust Blocker

**Status:** `DONE`

- [x] Stop `POST /api/login` from returning `passwordHash`; return an explicit public user DTO containing only `id`, `email`, and `displayName`.
- [x] Add regression tests proving setup, login, invitation, bootstrap/session, and other auth responses never expose password hashes or other authentication secrets.
- [x] Run focused authentication tests, the full automated suite, production build, and independent security re-test before marking this workstream `DONE`.

## 3. Visual Identity

**Status:** `BLOCKED`

The canonical Figma file exists, but Figma rejects all further MCP reads and
writes because the connected Starter plan has reached its tool-call limit.
Resume this workstream in the same file when quota is available; do not replace
the Figma source of truth with an unreviewed off-canvas approximation.

- [ ] After the public name is confirmed, use a Figma-capable design agent to create a simple canonical logo, wordmark, and square icon that replace the placeholder orange “C”.
- [ ] Keep the identity restrained and compatible with the existing calm UI, typography, and orange accent; do not create a large brand system.
- [ ] Define export variants sufficient for light backgrounds, favicon/app icon use, README/landing use, GitHub social preview, and Product Hunt assets.
- [ ] Store canonical source/export references so every public surface reuses the same identity.

## 4. Application Branding Integration

**Status:** `IN_PROGRESS`

- [ ] Integrate the approved name, logo/wordmark, and icon into setup, login, invitation, workspace identity where appropriate, browser title, favicon, and basic page metadata.
- [x] Add concise description and social metadata to the public HTML surface where applicable.
- [x] Correct the Members-page statement that Members can delete pages; deletion is admin-only.
- [ ] Validate branding and naming consistency without redesigning the application shell or editor.

## 5. Landing Page

**Status:** `TODO`

- [ ] Use a Figma-capable design agent to design a minimal public landing page after naming and identity are final.
- [ ] Include only: product name/logo, strong headline, short explanation, main product screenshot, 3–5 concise capabilities, GitHub/self-host CTA, supporting screenshots or product states, and a simple footer.
- [ ] Do not include testimonials, customer logos, usage claims, pricing, cloud plans, or unsupported features.
- [ ] Implement the accepted Figma design as a separate repository task, reusing the application’s typography, orange accent, and canonical identity.
- [ ] Validate responsive layout, CTA targets, metadata, accessibility basics, production build, and a clean public first impression.

## 6. Launch Screenshots & Assets

**Status:** `IN_PROGRESS`

- [x] Prepare a clean synthetic demo workspace in the actual running application; include realistic technical documentation and no personal data, secrets, local paths, or unfinished states.
- [x] Capture a hero screenshot showing a finished page and useful nested page tree.
- [x] Capture 3–5 representative states: rich technical editing with media/attachment, content search, revision history, nested organization, and member invitation.
- [ ] Compose/export a GitHub social-preview image using the canonical identity and strongest product state.
- [ ] Prepare Product Hunt gallery images from the same screenshots and identity.
- [x] Record a concise 60–90 second demo/GIF/video showing setup, runbook creation, nesting, search, history, and invitation; keep this lightweight and factual.

## 7. Self-Hosting / Public Documentation

**Status:** `DONE`

- [x] Document supported configuration, including `APP_DATA_DIR`, `PORT`, `NODE_ENV`, and `SECURE_COOKIES` where relevant.
- [x] Add production guidance stating that port 3000 is plain HTTP, requiring TLS through a reverse proxy and `SECURE_COOKIES=true`; warn against exposing port 3000 directly to the internet.
- [x] Make installation prerequisites and the source-build Docker path explicit from clone through first-run setup.
- [x] Define one repeatable update flow: back up, fetch/checkout a release, rebuild/recreate, run health checks, inspect logs, and recover if startup fails.
- [x] Update backup guidance to require a fresh empty or timestamped destination and verify that `database.sqlite` and `uploads/` are present together.
- [x] Add compact troubleshooting for port conflicts, unhealthy/startup or migration failures, storage permissions/disk space, reverse-proxy/cookie problems, and support/reporting paths.
- [x] Re-verify fresh install, restart/recreation persistence, backup, restore, update instructions, uploads, health checks, and clean logs against the final documentation.

## 8. GitHub Public Readiness

**Status:** `IN_PROGRESS`

- [x] Add the complete MIT `LICENSE` with the correct copyright holder and year.
- [x] Re-audit tracked files and history for secrets, private data, local artifacts, broken links, and stale temporary material; no credentials, keys, runtime data, or private user content were found.
- [x] Retain the agent configuration and completed implementation references as contributor context, while removing them from the final README's primary product path.
- [x] Add a concise `SECURITY.md` with a private vulnerability-reporting path and lightweight contribution guidance appropriate for an initial release.
- [ ] Configure final repository description, homepage, topics, canonical social preview, and naming consistency; keep the repository private until all launch gates pass.
- [x] Create a `v0.1.0` release plan with installation notes, backup/update warning, and concise known limitations; publish the tag/release only at launch.
- [ ] Verify license detection, repository links, clone/quick-start commands, and the public repository structure before changing visibility.

## 9. README — FINAL STEP

**Status:** `TODO`

Start only after the name, identity, landing page, screenshots, positioning, and self-hosting documentation are stable.

- [ ] Rewrite the README as a concise public repository landing page using the final canonical assets.
- [ ] Include product name/logo, one-line description, hero screenshot, concise value proposition, key capabilities, quick start, persistence and self-hosting basics, selected screenshots, focused product philosophy/scope, and MIT license link.
- [ ] Link to the landing page, production/self-hosting guidance, security reporting, and contribution guidance.
- [ ] Remove or relocate prominent internal orchestration instructions that distract from evaluating and running the product.
- [ ] Validate every command and link from a clean checkout and confirm the README does not claim unavailable distribution paths or features.

## 10. Final Launch Review

**Status:** `TODO`

- [ ] Run an independent Product Readiness Review against the actual final running product.
- [ ] Run an independent GitHub Readiness review against the final repository, metadata, license, release plan, and README.
- [ ] Run an independent Launch Surface review against the final landing page, identity, screenshots, social preview, and CTAs.
- [ ] Run an independent Product Hunt readiness review against the final pitch, gallery, demo, differentiation, and public product page.
- [ ] Require the final verdict **READY TO LAUNCH**. If the verdict is **READY AFTER SMALL FIXES** or **NOT READY TO LAUNCH**, add only genuine new blockers back into this file and re-run the affected gate after fixes.

## Launch Blockers

- [x] Authentication responses do not expose `passwordHash` or any other password verifier/secret.
- [x] The repository contains a valid MIT license.
- [x] Production HTTPS, reverse-proxy, and secure-cookie requirements are documented and verified.
- [ ] An evaluatable public launch surface exists: canonical identity, minimal landing/product page, real screenshots, clear CTA, and social preview.
- [ ] Figma MCP quota is available so the canonical identity and landing design can be created and validated in the launch file.

## Important Improvements

- [x] Correct Member deletion permissions copy.
- [x] Make update, backup, and troubleshooting instructions operationally repeatable.
- [x] Curate public repository/process documentation and add lightweight security/contribution guidance.
- [ ] Prepare coherent Product Hunt gallery assets and a short factual demo.

## Post-Launch Opportunities

- Publish a versioned GHCR image to remove the local-build requirement.
- Add issue/PR templates after outside contribution volume justifies them.

## Final Gate

- [ ] All launch blockers `DONE`
- [x] Product name finalized
- [ ] Logo / identity finalized in Figma
- [ ] App branding integrated
- [ ] Landing page designed in Figma
- [ ] Landing page implemented and validated
- [ ] Launch screenshots/assets ready
- [x] Self-hosting/public documentation verified
- [ ] GitHub public readiness complete
- [ ] Final README complete
- [ ] Independent Product Readiness Review = **READY TO LAUNCH**
