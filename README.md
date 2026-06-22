# SALT — Meet. Eat. Befriend.

Mobile-first campus social app built with **React**, **TypeScript**, **Vite**, and **Firebase**.

## Run locally

```bash
npm install
cp .env.example .env   # fill in Firebase web config
npm run dev
```

Without `.env`, sign-in is disabled until Firebase keys are configured.

## Firebase setup

1. Create a [Firebase project](https://console.firebase.google.com/).
2. Enable **Authentication → Email/Password**.
3. Create a **Firestore** database.
4. Register a **Web app** and copy config into `.env`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

5. Deploy Firestore rules and indexes:

```bash
npm run deploy:firestore
```

### Spark plan (default)

The app runs on the **free Spark plan** with **no Cloud Functions**. Auth, profiles, posts, votes, chats, and ratings are handled in the **client** under Firestore Security Rules.

Optional Cloud Functions in `firebase/functions/` require **Blaze** and are not required for the live app.

## Host at app.salt-usa.com (GitHub Pages)

The frontend deploys automatically on push to `main` via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

### One-time GitHub setup

1. Push this repo to GitHub.
2. **Settings** → **Pages** → Source: **GitHub Actions**.
3. Add all six `VITE_FIREBASE_*` repository secrets under **Settings** → **Secrets and variables** → **Actions**.
4. In Firebase Console → **Authentication** → **Authorized domains**, add `app.salt-usa.com`.

### DNS

`public/CNAME` is set to `app.salt-usa.com`. Point a CNAME record `app` → `<username>.github.io`.

## Allowed campuses

- `@uic.edu`
- `@illinois.edu`
- `@mit.edu`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run deploy:firestore` | Firestore rules + indexes |
| `npm run create:test-user` | Create a verified test account (service account required) |
| `npm run cleanup:expired-posts` | Delete expired posts from Firestore (service account required) |

## Project structure

```
src/
  context/       App state + Firebase session
  services/      Auth, posts, chats, ratings
  screens/       UI screens
firebase/
  firestore.rules
  firestore.indexes.json
  functions/     Optional (Blaze only)
```
