# Tech Stack

This document lists every technology the project depends on and the reason each
one was chosen.

## Overview

| Layer | Technology | Version |
| ----- | ---------- | ------- |
| Framework | Next.js (App Router) | 16.1.6 |
| UI library | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Plain CSS with custom properties | n/a |
| Linting | ESLint with `eslint-config-next` | 9.x |
| Runtime | Node.js | 20 or newer |
| Package manager | npm | 10 or newer |
| Model | Qwen2.5-Coder-14B-Instruct | n/a |
| Model host | Kaggle notebook on a free T4 GPU | n/a |
| Tunnel | ngrok | n/a |
| Frontend host | Vercel | n/a |
| Notifications | GitHub Actions plus a Discord webhook | n/a |

## Frontend

**Next.js 16 with the App Router.** The App Router gives us server components
for the shell and a route handler for the chat proxy in the same codebase, so
there is no separate backend service to deploy. Vercel builds and hosts the
result with zero configuration.

**React 19.** Used for the chat surface, the settings dialog, and the in app
setup guide. State is local to the page component, since the app has a single
screen and no cross route state to share.

**TypeScript.** Every source file is typed. This matters most at the boundary
with the model server, where a malformed streaming chunk should surface as a
compile time or parse time error rather than a blank screen.

**Plain CSS.** All styling lives in `src/app/globals.css` as a set of CSS custom
properties plus component classes. The design is a dark glassmorphism theme with
animated gradients. A utility framework was not added because the surface area
is one screen and the custom properties already act as the design tokens.

## Backend proxy

The route handler at `src/app/api/chat/route.ts` is a thin proxy. It takes the
conversation, the user supplied ngrok URL, and the user supplied API key, then
forwards an OpenAI compatible `chat/completions` request to the model server
with `stream: true` and pipes the response straight back to the browser.

The proxy exists for three reasons. It avoids browser CORS restrictions against
the ngrok host, it lets us attach the `ngrok-skip-browser-warning` header that
the free ngrok tier requires, and it enforces a 55 second upstream timeout so a
sleeping Kaggle notebook fails with a clear message instead of hanging.

## Model backend

The model is **Qwen2.5-Coder-14B-Instruct**, served from a Kaggle notebook on
the free T4 GPU tier behind an ngrok tunnel. It speaks the OpenAI chat
completions protocol, which is why the proxy can stay so small. Each user brings
their own backend URL and key, entered through the settings dialog and kept in
`localStorage` under `kaggle-api-url` and `kaggle-api-key`. Nothing is stored on
the server.

## Tooling and automation

**ESLint** with the Next.js configuration runs through `npm run lint`.

**GitHub Actions** runs `.github/workflows/discord-notify.yml`, which posts an
embed to the project Discord channel on pushes to `main` and `dev`, pull request
activity, issue activity, branch creation and deletion, and forks. The webhook
URL is stored as the repository secret `DISCORD_WEBHOOK_URL` and is never
committed.

## Deliberate omissions

There is no database, no authentication layer, and no server side session store.
The app is stateless by design: conversations live in browser memory and
credentials live in `localStorage`. Adding any of these would mean running
infrastructure, which works against the goal of a chatbot that costs nothing to
operate.

No test framework is configured yet. When one is added, Vitest with React
Testing Library is the intended choice, since it needs no extra build step on
top of the existing TypeScript setup.
