# Product Hunt copy and demo

## Listing

**Tagline**

A lightweight, self-hosted wiki for small software teams

**Description**

Pagecairn gives small software teams one focused place to write, organize,
and find documentation. Create nested pages, write rich technical docs with
code, tables, checklists, images, and files, search titles and content, restore
earlier revisions, and invite teammates with simple Admin and Member roles.
It runs as one application container with SQLite and local uploads in a
persistent data volume. Version 0.1.0 is built from source with Docker and does
not require Redis, object storage, or an email service.

## Maker first comment

I built Pagecairn for small software teams that need a useful internal wiki
without operating a workspace platform. The goal is deliberately narrow: open
it, write documentation, and find it later while keeping the complete
installation under your control.

The first release covers the everyday documentation loop: nested pages, rich
technical content, full-text search, revision history, images and file
attachments, and link-based teammate invitations. The default deployment is
one application container with SQLite and local uploads stored together in a
persistent `/data` volume.

Pagecairn is MIT licensed and self-hosted. Version 0.1.0 is distributed as
source, so the current Docker quick start builds the application locally. The
scope is intentionally small: one workspace per installation, local accounts,
manual sharing of invitation links, and no real-time multiplayer editing.

I would especially value feedback on the writing, navigation, search, and
self-hosting experience for teams of roughly 2–20 people.

## Gallery captions

Use these in order so the gallery moves from the core workspace to recovery
and self-hosting. Each caption is mapped to an existing launch panel built
from captures of the running application.

1. `docs/assets/launch/product-hunt-01-overview.png`
   - **Headline:** Documentation without the workspace sprawl
   - **Caption:** Keep technical and company knowledge in one calm workspace with a clear nested page tree.

2. `docs/assets/launch/product-hunt-02-editor.png`
   - **Headline:** Runbooks that contain the useful details
   - **Caption:** Combine headings, checklists, code, tables, images, and downloadable files in a finished technical page.

3. `docs/assets/launch/product-hunt-03-search.png`
   - **Headline:** Find the answer from anywhere
   - **Caption:** Search page titles and content, then jump directly to the documentation you need.

4. `docs/assets/launch/product-hunt-04-history.png`
   - **Headline:** Go back without losing what came after
   - **Caption:** Review saved revisions and restore an earlier version while retaining the later history.

5. `docs/assets/launch/product-hunt-05-self-host.png`
   - **Headline:** One container. One persistent volume.
   - **Caption:** Run Pagecairn with SQLite and local uploads in one complete, recoverable installation.

## 88-second demo narration and storyboard

Record from a clean local installation and use synthetic names and content.
Keep the browser chrome, terminal, localhost URL, passwords, invitation token,
and personal information out of frame. Use direct cuts between states rather
than waiting through builds or typing every line.

| Time | On screen | Narration |
| --- | --- | --- |
| 0:00–0:10 | Fresh setup screen; enter a synthetic workspace and admin, then open the workspace. | “Pagecairn is a lightweight, self-hosted wiki for small software teams. A fresh installation starts by creating one workspace and its first admin.” |
| 0:10–0:31 | Create **Production deployment**; add a heading, checklist, code block, small table, image, and file attachment. | “Create a page and write the technical details your team actually needs. Rich text, checklists, code, tables, images, and downloadable files all live in the same focused editor.” |
| 0:31–0:43 | Move the runbook beneath **Engineering handbook**; briefly expand and collapse the nested tree. | “Pages can contain other pages, so a simple nested tree is enough to organize engineering, product, and company documentation.” |
| 0:43–0:54 | Open search, enter **rollback**, and select the matching runbook result. | “Search looks across page titles and content, making a runbook quick to recover when it matters.” |
| 0:54–1:06 | Open History, select an earlier revision, show its preview, and point to Restore without confirming it. | “Every saved revision stays available. You can inspect an earlier version and restore it without discarding the revisions that followed.” |
| 1:06–1:20 | Open Members; enter a synthetic teammate email, choose Member, create a link, then obscure the token. | “Admins invite teammates with a seven-day link and choose a simple Admin or Member role. No email delivery service is required.” |
| 1:20–1:28 | Return to the finished runbook and nested tree; end on the product name and self-host call to action. | “Pagecairn runs as one application container with SQLite and local uploads in persistent storage. Build version 0.1.0 from source and keep your documentation under your control.” |

### Recording notes

- Target 1280×720 or 1920×1080 at 30 fps; keep UI text readable.
- Use only the synthetic **Northstar Engineering** workspace and demo pages.
- Show the invitation flow, but never display or publish a usable invitation token.
- Do not imply hosted cloud availability, email delivery, real-time editing, a
  prebuilt container image, customer adoption, or performance metrics.
- End on the repository/self-host CTA; do not add a pricing CTA.

## Lightweight preview

`docs/assets/launch/pagecairn-demo.gif` is a 64-second, seven-frame product
preview assembled from the real 1280×720 captures. It covers first-run setup,
nested organization, rich editing, media and files, search, history, and member
invitation. Use the narrated storyboard above when a full-motion recording is
preferred for the launch listing.
