# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on port 3009
npm run build    # Production build
npm run lint     # ESLint checks
```

No test framework is configured.

## What This App Is

**SMC Viewer** is a Next.js 16 (App Router) application for Smart Money Concepts (SMC) technical analysis. It has two main systems:

1. **SMC Animation Viewer** (`/smc-viewer`) — scrubs through 400+ frames of OHLC candlestick data with 17 toggleable SMC indicators (FVG, BOS, CHoCH, Order Blocks, Liquidity, etc.), multi-timeframe alignment view, and jump-to-event navigation.

2. **Engine 2 Hub** (`/engine2`) — 4-tab diagnostic/calibration interface for an SMC interpretation engine: Reference, Diagnostics, Evaluate, and Tune tabs. Runs algorithmic interpretation of frames against SMC rules with tunable weights/thresholds.

## Architecture

### Data Flow (SMC Viewer)

```
/public/data/*.json (frame datasets)
  → useSMCPlayer hook (playback state machine)
  → frameToPlotly() (lib/frame-to-plotly.ts)
  → <SMCChart> (components/chart.tsx, Plotly.js wrapper)
  → PlaybackControls, IndicatorPanel, JumpToEvent
```

Each JSON dataset contains an array of `SMCFrame` objects, one per candle, with the full indicator state at that moment.

### Engine 2 Data Flow

```
User selects symbol/timeframe/timestamp
  → GET /api/alignment-engine/interpretation (lib/interpretation-engine.ts)
  → MarketInterpretation result
  → AlignmentPanel (components/alignment-panel.tsx)
  → localStorage (checklist responses, analysis history, version overrides)
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/smc-types.ts` | All core types: `SMCFrame`, `SMCDataset`, `IndicatorId` (17 indicators), `MarketInterpretation` |
| `lib/use-smc-player.ts` | Playback hook — frame index, play/pause, speed (0.25×–4×), indicator visibility |
| `lib/frame-to-plotly.ts` | Converts `SMCFrame` → Plotly shapes/traces for each indicator type |
| `lib/interpretation-engine.ts` | Core SMC scoring logic for Engine 2 |
| `lib/chart-settings-context.tsx` | React context for cross-chart settings via `useChartSettings` / `useChartSettingsRegistration` |
| `lib/engine2-logic-config.ts` | Tunable rule weights/thresholds |
| `app/smc-viewer/page.tsx` | Main viewer page (~2200 lines); orchestrates all viewer state |

### API Routes (`app/api/`)

- `GET /api/alignment-engine/interpretation` — SMC interpretation for a frame (calls `interpretation-engine.ts`)
- `GET /api/alignment-engine/diagnostics` — Diagnostic results across frames
- `GET /api/wave-engine/state` — Wave engine state data
- `POST /api/smc-frames` — Fetch frames from Supabase (optional; requires `.env.local`)

All fetch effects use a `cancelled` flag pattern to avoid state updates after unmount.

### State Persistence

- **URL search params** — multi-TF overlay trigger, Engine 2 tab selection
- **localStorage** — Engine 2 checklist responses, loaded analysis results, tuning overrides (`engine2-version-store.ts`)
- **React Context** — shared chart settings (`ChartSettingsContext`)

### Supabase (Optional)

`.env.local` with Supabase credentials enables live frame fetching via `/api/smc-frames`. Without it, the app falls back to static JSON files in `/public/data/`.

## Tech Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript 5** (strict)
- **Tailwind CSS 4**, **shadcn/ui** (Radix UI primitives)
- **Plotly.js** (`react-plotly.js` + `plotly.js-dist-min`) for charting
- **Motion.js v12** for animations; **vaul** for drawer animations
- **react-resizable-panels** for layout
- **Lucide React** for icons
- Path alias: `@/*` → project root
