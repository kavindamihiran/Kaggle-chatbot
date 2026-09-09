# Architecture

## System overview

The application has three parts that run in three different places. The browser
holds all conversation state, the Vercel deployment holds a stateless proxy, and
a Kaggle notebook holds the model.

```text
  Browser                    Vercel                      Kaggle
+-------------+         +----------------+         +-------------------+
|             |  POST   |                |  POST   |                   |
|  page.tsx   +-------->+  /api/chat     +-------->+  Qwen2.5-Coder    |
|  chat UI    |         |  route handler |         |  14B + ngrok      |
|             +<--------+                +<--------+                   |
+------+------+  stream +----------------+  stream +-------------------+
       |
       v
  localStorage
  (api url, api key)
```

## Request lifecycle

1. The user types a message. `src/app/page.tsx` appends it to the local
   `messages` array and renders it immediately, so the UI never waits on the
   network to feel responsive.
2. The page posts `{ messages, apiUrl, apiKey }` to `/api/chat`. The URL and key
   come from `localStorage`, not from the server.
3. The route handler validates that `apiUrl` is present, normalises it by
   stripping trailing slashes and appending `/v1` if missing, then issues an
   OpenAI compatible `POST /v1/chat/completions` to the model server.
4. The upstream request carries a 55 second `AbortController` timeout, a bearer
   token, and the `ngrok-skip-browser-warning` header that the free ngrok tier
   requires before it will return content instead of an interstitial page.
5. The model streams server sent events back. The route handler forwards that
   stream to the browser without buffering it.
6. The page reads the stream chunk by chunk and appends tokens to the in flight
   assistant message, which is what produces the typing effect.

## Why the proxy exists

The browser cannot call the ngrok URL directly for three reasons, and the proxy
solves all of them in one place:

- **CORS.** The model server does not send the headers a cross origin browser
  request would need.
- **The ngrok interstitial.** Free tunnels return a warning page unless the
  request carries `ngrok-skip-browser-warning`, which a browser will not let the
  page set on a cross origin request.
- **Timeouts.** A Kaggle notebook that has gone to sleep would leave the browser
  hanging. The proxy bounds the wait and returns a readable error instead.

The proxy holds no state. It reads nothing from a database and writes nothing to
one. If it restarts mid conversation, the next message works exactly as before,
because the conversation lives in the browser.

## Credential handling

Each user supplies their own backend. The settings dialog writes the ngrok URL
and API key to `localStorage` under `kaggle-api-url` and `kaggle-api-key`, and
`page.tsx` reads them back on mount. They are sent to the proxy with every
request and are never persisted server side.

The route handler falls back to `process.env.API_KEY` when the client sends no
key, which lets a self hosted deployment ship a shared key without changing the
client.

## Component structure

`src/app/page.tsx` is the single client component that owns all state: the
message list, the streaming buffer, the settings dialog, and the scroll
position. It is deliberately one file, because splitting a single screen across
several components would mean lifting most of that state back up anyway.

Three components support it:

- `components/SetupGuide.tsx` renders the in app walkthrough for standing up a
  Kaggle backend, so a new user never has to leave the app to find the docs.
- `components/CodeCell.tsx` renders a copyable notebook cell inside that guide.
- `components/Icons.tsx` holds the inline SVG icon set, which avoids pulling in
  an icon package for a handful of glyphs.

`src/app/layout.tsx` provides the HTML shell and font setup.
`src/app/globals.css` holds the design tokens and every component style.

## Error handling

Failures are classified before they reach the user. A missing `apiUrl` returns a
400 that tells the user to open Settings. An upstream abort is reported as a
timeout with a suggestion to check that the Kaggle notebook is awake. Any other
upstream failure is surfaced with its status so the cause is visible rather than
hidden behind a generic message.

## Deployment

Vercel builds the Next.js app on every push to `main` and serves both the static
frontend and the route handler. The Kaggle notebook is started manually by the
user, since a free notebook session expires and cannot stay up permanently.

## Known constraints

The Kaggle session expires after a fixed run time, so the ngrok URL changes each
time the notebook restarts and the user must update it in Settings. Conversation
history is lost on page reload, because nothing is persisted. Only one model is
wired in, and its name is hardcoded in the route handler.
