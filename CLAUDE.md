# AI Caddie

React Native app that generates personalized hole-by-hole golf strategy playbooks for recreational golfers.

## Architecture

Monorepo with two apps:

- `apps/api/` — Hono API server (Node.js + tsx, Drizzle ORM, PostgreSQL, Railway)
- `apps/mobile/` — Expo React Native app (Expo Router, Nativewind, Zustand, React Query)
- Root `index.html` + `Dockerfile` — Original static prototype (nginx)

## API Server (`apps/api/`)

```
npm run dev          # Start dev server with hot reload
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run Drizzle migrations
npm run db:seed      # Seed 20 LA courses via Claude API
npm run typecheck    # TypeScript check
```

Required env vars: `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `OPENWEATHER_KEY`

## Mobile App (`apps/mobile/`)

```
npx expo start       # Start Expo dev server
```

Required: `EXPO_PUBLIC_API_URL` pointing to the deployed API

## Key Design Decisions

- Bogey-first mindset: playbook assumes bogey as baseline, pars are bonuses
- Claude Sonnet generates playbooks server-side, cached per player+course+tee+date
- Weather is the regeneration trigger via OpenWeather API
- JWT auth with jose, bcrypt for passwords, Apple Sign-In support
