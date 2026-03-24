# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```
artifacts/
  api-server/      Express REST API (port 8080)
  mobile/          Expo React Native app — "Tommy"
  mockup-sandbox/  Component preview server (Vite)
packages/
  api-client-react/  Generated React Query hooks from OpenAPI
  db/                Drizzle schema + migrations
```

## Tommy — Personal Advisor App

**App name**: Tommy  
**Purpose**: Personal advisor for finances, daily decisions, time planning, and agenda management.  
**Target user**: PCD (Visão Monocular) in Serra/ES — has IPVA + IOF exemptions.

### Architecture — MVVM + Clean Code

```
models/          TypeScript interfaces (Decisao, AgendaItem)
services/        API communication layer (baseApi, FinanceService, AgendaService)
viewmodels/      React hooks bridging model ↔ view (useFinanceViewModel, useAgendaViewModel)
app/(tabs)/      Pure view screens
constants/       finance.ts (hardcoded context), colors.ts (design tokens)
components/      Shared UI components
```

### Finance Context (hardcoded, immutable)

- Salário bruto: R$ 10.460,00
- Salário líquido: R$ 7.872,72 (1 dependente)
- VA mensal: R$ 811,80 (R$ 36,9/dia útil)
- Sobra mensal: R$ 4.797,37
- Meta Sandero 2015: R$ 30.000,00 à vista
- Custos fixos total: R$ 2.575,35

### Tabs

1. **Início** — Dashboard financeiro (hero number, KPIs, metas, detalhes)
2. **Tommy** — AI advisor (voice + chat, waveform orb, impact analysis)
3. **Agenda** — Task management (prioridade, categoria, toggle concluído)
4. **Histórico** — Decisão log (gasto extras, impact preview)

### Color Palette (v3 — Tommy Modern)

- `bg`: #09090E (deep indigo-dark)
- `accent`: #7C6EFA (violet — trust, calm)
- `money`: #F59E0B (amber — financial)
- `positive`: #10B981 (mint)
- `negative`: #EF4444 (soft red)

### Database Tables

- `decisoes` — extra expenses with impact on Sandero goal
- `agenda_items` — tasks with title, description, category, priority, done state

### Key Patterns

- `baseApi.ts` wraps all fetch calls with unified error handling
- ViewModels use React Query (`useQuery`, `useMutation`) for server state
- Optimistic updates on delete mutations
- `calcularImpactoSandero(valor)` returns days delayed for Sandero goal
- `expo-av` used for voice recording (deprecated warning is expected — upgrade in SDK 54)
- `expo-speech` NOT in app.json plugins (causes PluginError)
- `expo-audio` NOT installed (causes Metro ENOENT crash)

## API Routes

- `GET/POST /api/decisoes` — financial decisions
- `DELETE /api/decisoes/:id`
- `GET/POST /api/agenda` — agenda items
- `PATCH /api/agenda/:id` — update/toggle done
- `DELETE /api/agenda/:id`
