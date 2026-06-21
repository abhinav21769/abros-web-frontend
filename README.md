# Abros Healthcare Frontend

React dashboard for medicine inventory, customers, and invoices.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (default: `http://localhost:3000` locally) |
| `VITE_UPI_ID` | UPI VPA for scan-to-pay QR codes (e.g. `storename@paytm`) |
| `VITE_UPI_PAYEE_NAME` | Payee name shown in UPI apps (default: `ABROS HEALTHCARE`) |

Production builds use `https://abros-healthcare.onrender.com` automatically.

## Deploy

```bash
npm run deploy
```

Or push to `main` — GitHub Actions deploys to Firebase Hosting.

**Live URL:** https://abros-healthcare.web.app

## Backend

API repo: [abros-web-backend](https://github.com/abhinav21769/abros-web-backend)
