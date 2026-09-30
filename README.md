# Jogo Crew Leads

Internal tracker for crews we're recruiting onto Jogo: a US map of every lead,
pipeline status, handles (Instagram / Facebook / WhatsApp), and an activity log
the whole team shares.

Separate from the admin portal on purpose: no Google sign-in. People get in with
**their name + a shared team access code**.

## How access works

- `/login` asks for a name and the access code. The code is checked on the server.
- A correct code sets a signed, HTTP-only cookie that lasts 30 days. Every page and
  API route checks it (`src/middleware.js`, plus each API route).
- The name is attached to everything that person logs ("Moved to In talks · Maria").
- **To revoke access, change `LEADS_ACCESS_CODE`.** That signs everyone out immediately.
- The browser never talks to Firebase. All reads and writes go through this app's
  API routes using the Firebase Admin SDK, so lead data is only ever sent to people
  who entered the code.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

| Variable | What it is |
| --- | --- |
| `LEADS_ACCESS_CODE` | The team code. Use something longer than a PIN. |
| `LEADS_SESSION_SECRET` | Random string for signing cookies: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FIREBASE_SERVICE_ACCOUNT_B64` | Same service account as the admin portal (base64 JSON). Locally you can use the three `FIREBASE_ADMIN_*` vars instead. |
| `GOOGLE_MAPS_API_KEY` | Optional. Used for "Find on map"; falls back to OpenStreetMap without it. |
| `LEADS_FIRESTORE_DATABASE` | Optional. Name of a separate Firestore database to store leads in (see below). |

## Deploying (Vercel)

1. Push this folder to its own GitHub repo.
2. Import it as a new Vercel project.
3. Add the env vars above under Project → Settings → Environment Variables.
4. Deploy, then share the URL and the code with the team.

## Where the data lives

Leads are stored in the `crew-leads` collection of the Jogo Firebase project.

Note: the app's Firestore rules include a catch-all that lets any signed-in Jogo
app user read any collection. To keep leads fully out of reach of the app, create a
separate Firestore database (Firebase console → Firestore → Add database, e.g. `leads`)
and set `LEADS_FIRESTORE_DATABASE=leads`. A new database starts with deny-all rules,
and this app's Admin SDK access isn't affected by rules.
