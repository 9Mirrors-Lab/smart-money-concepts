# Elliott Wave (EWO & wave engine)

Docs for the Elliott Wave Oscillator (EWO), the deterministic wave engine (Engine 1), and the alignment confidence engine (Engine 2) in this project.

| Doc | Description |
|-----|--------------|
| [MARKET_CANDLES_EWO.md](MARKET_CANDLES_EWO.md) | EWO formula (mean, sma_5, sma_35, ewo), `market_candles_ewo` view, data source |
| [WAVE_ENGINE_CHART_INTEGRATION.md](WAVE_ENGINE_CHART_INTEGRATION.md) | Wave engine output (`wave_engine_state`), chart join, query patterns, API |
| [wave-engine-example-query.sql](wave-engine-example-query.sql) | Example SQL for wave_engine_state |
| [ALIGNMENT_ENGINE.md](ALIGNMENT_ENGINE.md) | Engine 2: inputs, output table (`wave_alignment_scores`), weights, scoring, run/validate |
| [alignment-engine-validation.sql](alignment-engine-validation.sql) | Engine 2 validation queries (impulse/chop/terminal windows, latest-per-TF report) |

**Engine 1 (wave):** POST `/api/wave-engine/run` (body: symbol, optional timeframe, from, to, lookback).  
**Validate Engine 1:** `npx tsx scripts/validate-wave-engine.ts [--unit-only] [--symbol SYMBOL] [--timeframe TF] [--lookback N]`.

**Engine 2 (alignment):** Run after Engine 1. `npm run run-alignment-engine` or POST `/api/alignment-engine/run` (body: symbol?, timeframe?, from?, to?, fullRebuild?).  
**Validate Engine 2:** `npm run validate-alignment-engine` with window bounds; or run queries in [alignment-engine-validation.sql](alignment-engine-validation.sql).

---

## Wave engine logic (source of truth)

The engine is a **sequential state machine**: one pass over ordered candles (per symbol, per timeframe), one output row per candle. Logic lives in code; this section summarizes it and links to the files.

**Code:** [lib/wave-engine/state-machine.ts](../../../lib/wave-engine/state-machine.ts) (state machine) · [lib/wave-engine/types.ts](../../../lib/wave-engine/types.ts) (constants, input/output types) · [lib/wave-engine/run.ts](../../../lib/wave-engine/run.ts) (fetch from `vw_candles_with_ewo`, run per timeframe, upsert to `wave_engine_state`).

### Constants ([types.ts](../../../lib/wave-engine/types.ts))

| Name | Value | Meaning |
|------|--------|---------|
| `N_PERIOD` | 40 | Lookback for "new n-period high" (EWO) and for Condition B (lowest EWO over last n). |
| `TRIGGER` | 0.35 | Condition B: wave 3 starts when `ewo > TRIGGER * lowestEwoN` (after other conditions). |
| 5-period high window | 5 | Wave 4→5: current high must be max of last 5 highs (preceding 4 + current). |

### Input

- **Source:** View `vw_candles_with_ewo` (columns: symbol, timeframe, timestamp, mean, sma_5, sma_35, ewo, open, high, low, close, volume). Runner maps `mean` → input `mean`; null/NaN EWO treated as 0.
- **Order:** Rows must be ordered by `timestamp` ascending per (symbol, timeframe).

### State and evaluation (per candle)

- **Internal state:** `current_trend` (UP/DOWN), `current_wave` (3, 4, 5, NONE), `wave_peak_ewo`, `wave_peak_price`, `wave_start_time`, `prior_wave3_peak_ewo`, sliding windows `ewoWindow` (last n EWO values), `highWindow` (last 5 highs).
- **New n-period high (Condition A):** `current_ewo > max(ewo over previous n rows)` (n = N_PERIOD). Uses only **preceding** candles for the max; the current bar is not in that max. Sets `new_n_high_flag` when this starts wave 3.
- **Condition B:** EWO &lt; 0, trend was DOWN, and `ewo > TRIGGER * min(ewo over last n bars including current)`. Alternative wave 3 start; does not set `new_n_high_flag`.
- **5-period high:** Current bar’s **high** is the maximum of (preceding 4 highs + current high). Used only for 4→5 transition.
- **Zero cross:** EWO goes from positive to ≤ 0 while in wave 3 → transition to wave 4; `zero_cross_flag` true on that bar.
- **Retrace trigger:** Only way into wave 5: already in wave 4, 5-period high is made, and EWO &gt; 0. Set only on that 4→5 bar (`retrace_trigger_flag`). Zero cross alone does not set it.

### Transition rules (order of checks in [state-machine.ts](../../../lib/wave-engine/state-machine.ts))

1. **Reset:** In wave 5 and EWO &lt; 0 → trend DOWN, wave NONE, clear peaks; `engine_reset_flag` true.
2. **Down/neutral:** EWO &lt; 0 and not already in UP trend → trend DOWN, wave NONE.
3. **Wave 3 start:** Condition A (new n-period EWO high) **or** Condition B → trend UP, wave 3, set wave start and peaks; `new_n_high_flag` = Condition A.
4. **Wave 3 active:** In 3 and EWO ≥ current wave peak → update wave_peak_ewo and wave_peak_price.
5. **Wave 4 entry:** In 3 and EWO ≤ 0 → store prior_wave3_peak_ewo, wave 4, `zero_cross_flag` true.
6. **Wave 5 entry:** In 4, 5-period high made, EWO &gt; 0 → wave 5, update peaks, `retrace_trigger_flag` true.
7. **Wave 4 active:** In 4 (and no 5 entry this bar) → output current wave peaks.
8. **Wave 5 → 3 relabel:** In 5 and EWO &gt; prior_wave3_peak_ewo → relabel as wave 3, update peaks (extension).
9. **Wave 5 active:** In 5 and EWO ≥ wave_peak_ewo → update wave_peak_ewo and wave_peak_price.
10. **Default:** Output current state and peaks.

### Output

- One row per input row: symbol, timeframe, timestamp, trend_direction, wave_number, wave_phase, wave_start_time, wave_peak_ewo, wave_peak_price, zero_cross_flag, new_n_high_flag, retrace_trigger_flag, engine_reset_flag. Written to table `wave_engine_state` (upsert on symbol, timeframe, timestamp).

---

## Engine 2 (alignment / confidence layer)

Engine 2 runs **after** Engine 1. It does not change wave labels. It reads `wave_engine_state`, `vw_candles_with_ewo`, and `market_candles` (via the single view `vw_alignment_engine_input`), computes deterministic scores per candle, and writes to `wave_alignment_scores`.

- **Output table:** `wave_alignment_scores` — alignment_score, wave3_probability, wave5_exhaustion_probability, plus sub-scores (momentum, multi-TF stack, volatility regime, divergence health). Primary key (symbol, timeframe, timestamp).
- **Weights:** Table `wave_alignment_weights` (id `'default'`); configurable, must sum to 1.
- **Scoring:** Momentum (EWO magnitude/slope vs ATR), multi-timeframe stack (Wave 3 alignment across 1W/1D/360/90/23), volatility regime (ATR expansion/contraction), divergence (price vs EWO; stored as health), wave context weight. Probabilities capped when wave_number does not match (e.g. wave3_probability capped when not in Wave 3).

Full details, **data-flow diagram (Engine 1 ↔ Engine 2)**, run/validate commands, and code links: [ALIGNMENT_ENGINE.md](ALIGNMENT_ENGINE.md).
