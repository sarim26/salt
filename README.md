# SALT — Meet. Eat. Befriend.

Mobile-first campus social app built with **React**, **TypeScript**, **Vite**, and **Firebase**.

## Run locally

```bash
npm install
cp .env.example .env   # fill in Firebase web config
npm run dev
```

Without `.env`, the app runs in **offline demo mode** (UIC / UIUC / MIT buttons, in-memory data).

## Firebase setup

1. Create a [Firebase project](https://console.firebase.google.com/) (Blaze plan for blocking Auth functions).
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

5. Deploy rules, indexes, and functions:

```bash
npm install --prefix firebase/functions
npm run build --prefix firebase/functions
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,firestore:indexes,functions
```

### Allowed campuses

Only these email domains can sign up:

- `@uic.edu`
- `@illinois.edu`
- `@mit.edu`

Email verification is required before posting.

### Demo mode

UIC / UIUC / MIT buttons use **client-only sandbox** data — no Firebase session, no Firestore writes.

### Seed sample posts (optional)

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
node scripts/seedFirestore.mjs your-project-id
```

## Project structure

```
src/
  context/       App state (demo vs live Firebase)
  services/      Auth, posts, chats, ratings
  lib/           Firebase init
  screens/       UI screens
firebase/
  firestore.rules
  firestore.indexes.json
  functions/     Auth blocking, profile create, votes, ratings, expiry
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Cloud Functions

| Function | Purpose |
|----------|---------|
| `beforeCreate` | Block signups outside allowed .edu domains |
| `onAuthUserCreate` | Custom claim `schoolDomain` + `users/{uid}` profile |
| `onPostCreate` | Increment `postCount`, award first-post badge |
| `onVoteWrite` | Recompute post score from votes |
| `submitRating` | Callable — aura, decay, badges |
| `expirePosts` | Hourly cleanup of expired posts |
