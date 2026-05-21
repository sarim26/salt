# SALT — Meet. Eat. Befriend.

Mobile-first campus social demo built with **React**, **TypeScript**, and **Vite**. Faithful port of the original single-file HTML prototype (UI + behavior).

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Demo login

Use any password (3+ characters) with:

- `you@uic.edu` — UIC
- `you@illinois.edu` — UIUC
- `you@mit.edu` — MIT

Or tap **UIC**, **UIUC**, or **MIT** on the login screen.

## Project structure

```
src/
  components/     PostCard, BottomNav, PostSheet, RateOverlay, …
  screens/        Login, Feed, Explore, Chats, Chat detail, Profile
  context/        App state & actions (mirrors original JS)
  data/           Per-campus seed data
  utils/          Aura algorithms, formatting
  styles/         Global SALT stylesheet
```

## Build

```bash
npm run build
npm run preview
```
