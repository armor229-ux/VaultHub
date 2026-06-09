# Vault Hub — Premium Device Manager

A premium dark-themed utility web app (TWA-ready) built with Next.js 16, TypeScript 5, React 19, Tailwind CSS 4, and shadcn/ui.

## Quick Start

```bash
bun install          # Install dependencies
bun run db:push      # Push SQLite schema
bun run dev          # Start dev server → http://localhost:3000
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Development server (port 3000) |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Start production server |
| `bun run lint` | ESLint check |

## Deploy to Vercel

1. Push this repository to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. Vercel auto-detects Next.js — accept the default settings
4. Set the `DATABASE_URL` environment variable if using a hosted database (optional — SQLite is used locally by default)
5. Click **Deploy** — your app is live on HTTPS

Vercel handles HTTPS automatically, which is required for PWA/TWA installability.

## PWA / TWA Configuration

| File | Purpose |
|------|---------|
| `public/manifest.webmanifest` | Web app manifest (name, icons, display, theme) |
| `public/icon-192.png` | App icon 192×192 (maskable) |
| `public/icon-512.png` | App icon 512×512 (maskable) |
| `public/sw.js` | Service worker (cache-first static, network-first navigation) |

### Bubblewrap (TWA → Play Store)

After deploying to Vercel, use Google Chrome Labs' Bubblewrap CLI to generate a signed APK:

```bash
bubblewrap init --manifest https://YOUR-APP.vercel.app/manifest.webmanifest \
  --app-name "Vault Hub" --package-name com.vaulthub.app \
  --theme-color "#0d0d14" --background-color "#0d0d14" \
  --orientation portrait --sw "sw.js" \
  --sw-url https://YOUR-APP.vercel.app/sw.js \
  --start-url "/" --enable-navigation-toolbar

bubblewrap build   # → app-release-signed.apk
```

> **Note:** TWA cannot add native Android permissions via the web manifest. Use standard Web APIs (camera via `getUserMedia`, files via File System Access API, etc.) with user prompts.
