# Logs

A chronological record of notable changes to the project. Add an entry when you
ship something that changes behaviour, structure, or process. Routine
dependency bumps and typo fixes do not need one.

Newest entries first. Each entry gives the date, the branch or pull request, and
what changed along with why.

---

## 2026-09-09 | Discord webhook verified

Confirmed the notification pipeline end to end. The webhook URL was initially
saved as an environment secret on the Production environment, where the workflow
could not see it, since the notify job does not declare an `environment:` key.
Moving it to a repository secret fixed it.

If notifications ever go quiet, check that `DISCORD_WEBHOOK_URL` is listed under
Repository secrets rather than under an environment.

## 2026-09-09 | Repository setup

Brought the repository in line with the team project setup standard.

- Added `CONTRIBUTING.md` covering local setup, the branching model, commit
  message format, and the pull request process.
- Added `docs/` with `TechStack.md`, `Architecture.md`, `FolderStructure.md`,
  and this file.
- Added `.github/workflows/discord-notify.yml`, which posts an embed to the
  project Discord channel on pushes to `main` and `dev`, pull request activity,
  issue activity, branch creation and deletion, and forks. The webhook URL is
  read from the `DISCORD_WEBHOOK_URL` repository secret and the job exits
  quietly when that secret is absent, so forks do not fail.
- Created the `dev` branch as the integration target for feature work, leaving
  `main` as the stable deployable branch.

## 2026-09-07 | PR #2, `modern-ui-setup-guide`

Modernised the chat interface and added an in app Kaggle setup guide.

The guide was moved into the product because the backend setup is the single
hardest step for a new user, and sending them to an external README at that
moment was losing people. `SetupGuide.tsx` and `CodeCell.tsx` render
copy ready notebook cells directly in the header.

## 2026-02-27 | PR #1, `feature`

Hardened chat message processing with better error handling and an upstream
timeout.

A sleeping Kaggle notebook previously left the request hanging with no feedback.
The route handler now aborts the upstream call after 55 seconds and classifies
the failure, so the user sees a timeout message that names the likely cause
instead of a spinner that never resolves.

## 2026-02-27 | Auto scroll rework

Reworked chat auto scrolling to set `scrollTop` on the chat container directly
and added `overflow: hidden` to the main layout. The previous approach scrolled
the document, which fought with the fixed header on short viewports.

## 2026-02-27 | Input focus

Re-focused the message input after loading finishes and after a message is
submitted, so a user can send several messages without reaching for the mouse.

## 2026-02-27 | Streaming responses

Implemented streaming by transforming the upstream server sent events into a
text stream in the route handler and consuming that stream on the client. This
replaced the non streaming JSON approach introduced a few commits earlier, once
it was clear that a 14B model on a T4 takes long enough that a single blocking
response felt broken.

## 2026-02-27 | ngrok headers

Added the `ngrok-skip-browser-warning` and `User-Agent` headers to chat API
requests. Without the first header, a free ngrok tunnel returns an interstitial
warning page instead of the model response.

## 2026-02-27 | Bring your own API

Allowed each user to supply their own backend URL and API key through the
settings dialog, stored in `localStorage`. This removed the need for the project
to run or pay for any shared inference endpoint.

## 2026-02-27 | Initial commit

Scaffolded the project with Create Next App using the App Router, TypeScript,
and ESLint.
