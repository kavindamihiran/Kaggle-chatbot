# Folder Structure

## Tree

```text
Kaggle-chatbot/
├── .github/
│   └── workflows/
│       └── discord-notify.yml     GitHub Actions job that posts repo events to Discord
├── docs/
│   ├── Architecture.md            How the three tiers fit together and why
│   ├── FolderStructure.md         This file
│   ├── Logs.md                    Chronological record of notable changes
│   └── TechStack.md               Every dependency and the reason for it
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   └── vercel.svg                 Static assets served from the site root
├── src/
│   └── app/
│       ├── api/
│       │   └── chat/
│       │       └── route.ts       POST /api/chat, the streaming proxy to the model
│       ├── components/
│       │   ├── CodeCell.tsx       Copyable notebook cell used inside the setup guide
│       │   ├── Icons.tsx          Inline SVG icon set
│       │   └── SetupGuide.tsx     In app walkthrough for standing up the Kaggle backend
│       ├── favicon.ico
│       ├── globals.css            Design tokens and all component styles
│       ├── layout.tsx             Root HTML shell and font setup
│       └── page.tsx               The chat screen and all of its state
├── .gitignore
├── CONTRIBUTING.md                How to set up, branch, commit, and open a pull request
├── README.md                      Project overview and quick start
├── eslint.config.mjs              ESLint flat config extending eslint-config-next
├── next.config.ts                 Next.js configuration
├── package.json                   Scripts and dependencies
├── package-lock.json              Locked dependency tree, always committed
└── tsconfig.json                  TypeScript compiler options and path aliases
```

## Conventions

**Everything under `src/app/` is a route or supports one.** The App Router maps
directories to URLs, so `api/chat/route.ts` becomes `POST /api/chat` and
`page.tsx` becomes `/`. Do not put non route helpers directly in this tree.

**Components live in `src/app/components/`.** One component per file, named in
PascalCase to match the exported component. A component belongs here once it is
used in more than one place or once it is large enough that keeping it inline
would obscure the page it sits in.

**Styling is centralised in `globals.css`.** There are no CSS modules and no
styled components. Add a design token as a custom property on `:root` and use it
from a component class, so a colour or spacing change lands in one place.

**`public/` is served verbatim from the site root.** A file at `public/logo.svg`
is reachable at `/logo.svg`. Nothing in this directory is processed by the
bundler, so it should hold only static assets.

**`docs/` holds prose, not code.** Anything a new contributor needs to read
before touching the codebase goes here. Keep `README.md` short and point at
these files for depth.

## Where to add new code

| You are adding | Put it in |
| -------------- | --------- |
| A new page | `src/app/<route>/page.tsx` |
| A new API endpoint | `src/app/api/<name>/route.ts` |
| A reusable UI piece | `src/app/components/<Name>.tsx` |
| A new icon | An export in `src/app/components/Icons.tsx` |
| A style or design token | `src/app/globals.css` |
| A static image or font | `public/` |
| Project documentation | `docs/` |
| A CI or automation job | `.github/workflows/` |

## Files that are intentionally absent

There is no `src/lib/` or `src/utils/` directory yet. The project is small
enough that shared helpers have not been needed, and creating the folder before
there is anything to put in it invites premature abstraction. Add it when a
second file genuinely needs the same helper.

There is no `tests/` directory yet. See `docs/TechStack.md` for the intended
choice when tests are introduced.
