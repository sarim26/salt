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

5. Deploy backend:

```bash
npm install --prefix firebase/functions
npm run build --prefix firebase/functions
npx firebase login
npx firebase use salt-32292
npm run deploy:firebase
```

### Spark plan (default)

The app runs on the **free Spark plan** with **no Cloud Functions**. Auth profiles, posts, votes, chats, and ratings are handled in the **client** under Firestore Security Rules.

Deploy rules and indexes:

```bash
npm run deploy:firestore
```

(`deploy:firebase` is an alias for the same Firestore deploy.)

### Optional: Cloud Functions (Blaze only)

`firebase/functions/` includes server-side hooks (blocking signup domains, vote score aggregation, instant aura on rate). They require **Blaze** and `npm run deploy:functions`. The React app does **not** depend on them when using Spark.

## Host at app.salt-usa.com (GitHub Pages)

The frontend deploys automatically on push to `main` via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

### One-time GitHub setup

1. Push this repo to GitHub.
2. **Settings** → **Pages** → **Build and deployment** → Source: **GitHub Actions**.
3. **Settings** → **Secrets and variables** → **Actions** → **Repository secrets** (not Environment secrets) — add:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

   After adding secrets, **re-run the deploy** (Actions → Deploy to GitHub Pages → Run workflow). The live site does not update until a new build completes.

   The workflow fails the build if any secret is missing (no more silent “Firebase not configured” deploys).

4. In [Firebase Console](https://console.firebase.google.com/) → **Authentication** → **Settings** → **Authorized domains**, add:
   - `app.salt-usa.com`
   - `<your-username>.github.io` (optional, for preview URLs)

### DNS (custom domain)

`public/CNAME` is set to `app.salt-usa.com` and is copied into `dist` on build.

At your DNS provider for `salt-usa.com`:

| Type | Name | Value |
|------|------|--------|
| CNAME | `app` | `<your-github-username>.github.io` |

In the repo: **Settings** → **Pages** → **Custom domain** → enter `app.salt-usa.com` → enable **Enforce HTTPS**.

### Manual deploy check (local)

```bash
npm run build:pages
npx vite preview --outDir dist
```

### Firebase backend only (not hosting the UI)

```bash
npm run deploy:firebase
```

Optional Firebase Hosting instead of GitHub Pages: `npm run deploy:hosting`

### Allowed campuses

Only these email domains can sign up:

- `@uic.edu`
- `@illinois.edu`
- `@mit.edu`

Email verification is required before posting.

### Profile photo

On the **Me** tab, tap the camera icon on your avatar to upload a photo. Without a photo, your initials (first + last name) are shown.

### Seed sample posts (optional)

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
node scripts/seedFirestore.mjs your-project-id
```

## Project structure

```
src/
  context/       App state + Firebase session
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
| `npm run build:pages` | Production build + `404.html` for GitHub Pages |
| `npm run deploy:firestore` | Firestore rules + indexes only (Spark OK) |
| `npm run deploy:firebase` | Rules, indexes, and functions (**Blaze required**) |
| `npm run deploy:hosting` | Build + deploy to Firebase Hosting (optional) |

## Cloud Functions

| Function | Purpose |
|----------|---------|
| `beforeCreate` | Block signups outside allowed .edu domains |
| `onAuthUserCreate` | Custom claim `schoolDomain` + `users/{uid}` profile |
| `onPostCreate` | Increment `postCount`, award first-post badge |
| `onVoteWrite` | Recompute post score from votes |
| `submitRating` | Callable — aura, decay, badges |
| `expirePosts` | Hourly cleanup of expired posts |
