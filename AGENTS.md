# Abros Web Frontend — Agent Instructions

## Commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 5173) |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Preview build | `npm run preview` |
| Deploy to Firebase | `npm run deploy` (runs build + firebase deploy) |

## Environment

- Copy `.env.example` to `.env` for local development
- Required vars: `VITE_API_URL`, `VITE_UPI_ID`, `VITE_UPI_PAYEE_NAME`, `VITE_SENTRY_DSN`
- Production API URL is `https://abros-healthcare.onrender.com` (set in CI)

## CI/CD

- Push to `main` → auto-deploys to Firebase Hosting (live)
- PRs from same repo → auto-deploys preview to Firebase
- Node 20 used in CI

## Architecture

- React 19 + Vite + Tailwind CSS v4
- Routing: `react-router-dom` v7
- State: React Context (see `src/context/`)
- API layer: `src/api/`
- Pages: `src/pages/`
- Components: `src/components/`
- Entry: `src/main.jsx` → `src/App.jsx`

## Key Files

- `vite.config.js` — port 5173, React + Tailwind plugins
- `eslint.config.js` — flat config, ignores `dist/`, React hooks + refresh rules
- `firebase.json` — SPA rewrite to `/index.html`, public dir = `dist/`

## Gotchas

- No test suite configured
- TypeScript not used (JS + JSDoc types via `@types/react`)
- No public signup — users created via backend CLI/admin
- Firebase project: `abros-healthcare`
- Live URL: https://abros-healthcare.web.app