# Contributing to Qwen AI Chat

Thanks for taking the time to contribute. This document explains how the
repository is organised, how to get a local environment running, and what we
expect from a pull request.

## Code of conduct

Be respectful and constructive. Assume good intent, keep review comments about
the code rather than the person, and give people time to respond.

## Getting started

1. Fork the repository, or clone it directly if you have write access.

   ```bash
   git clone https://github.com/kavindamihiran/Kaggle-chatbot.git
   cd Kaggle-chatbot
   ```

2. Install dependencies. The project targets Node.js 20 or newer.

   ```bash
   npm install
   ```

3. Start the development server.

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 and use the in app **Setup guide** to point the
   frontend at a running Kaggle backend.

## Branching model

The repository uses two long lived branches:

| Branch | Purpose |
| ------ | ------- |
| `main` | Stable, deployable code. Protected. |
| `dev`  | Integration branch where feature work lands first. |

All work happens on a short lived branch cut from `dev`:

```bash
git checkout dev
git pull origin dev
git checkout -b feat/short-description
```

Use one of the following prefixes so the branch name explains itself:

- `feat/` for a new capability
- `fix/` for a bug fix
- `docs/` for documentation only changes
- `refactor/` for changes that do not alter behaviour
- `chore/` for tooling, dependencies, and configuration

Open your pull request against `dev`. Only a maintainer merges `dev` into
`main`, and that merge is what triggers a release.

## Commit messages

We follow Conventional Commits. The first line is a single sentence in the
imperative mood, under about 72 characters:

```text
feat: stream assistant tokens as they arrive
fix: clear the upstream timeout when the request aborts
docs: describe the Kaggle backend setup
```

Add a body when the change needs justification. Explain why the change was
needed, not just what changed, since the diff already shows the what.

## Before you open a pull request

Run the checks locally and make sure they pass:

```bash
npm run lint
npm run build
```

Then confirm the following:

- The change is focused. One logical change per pull request.
- New behaviour is reflected in `README.md` or the relevant file in `docs/`.
- No secrets, API keys, ngrok URLs, or `.env` files are committed.
- The build produces no new TypeScript errors or ESLint warnings.

## Pull request process

1. Push your branch and open a pull request against `dev`.
2. Fill in the description with the motivation, a summary of the change, and
   the steps you used to verify it. Screenshots help for UI work.
3. Link any related issue with `Closes #123`.
4. Request a review. Address feedback with additional commits rather than a
   force push, so reviewers can see what changed.
5. Once approved, a maintainer squashes and merges.

Every push, pull request, issue, and branch event posts a notification to the
project Discord channel through the workflow in
`.github/workflows/discord-notify.yml`, so the team sees your work as it lands.

## Reporting bugs

Open an issue that includes what you expected, what actually happened, the
steps to reproduce, and your browser and Node.js versions. If the problem
involves the model backend, say whether the Kaggle notebook was running and
paste any error shown in the chat panel.

## Security

Do not open a public issue for a security problem. Contact a maintainer
directly instead. Never paste a live API key or ngrok URL into an issue, a pull
request, or the Discord channel.
