# Wave Engine – Chart Integration Guide

This document describes the deterministic Elliott Wave engine output so a chart team can overlay wave state on existing EWO charts (per timeframe).

---

## What the engine provides

The engine is a **sequential state machine** that runs over historical candles (with EWO) and writes **one row per candle per (symbol, timeframe)**. Each row labels that bar’s wave state: trend, wave number (3, 4, or 5), phase, and event flags. The result is **deterministic** and **idempotent**: same inputs produce the same rows; re-runs overwrite by primary key.

Your charts already have **EWO per timeframe**. To add wave labels, join engine results to your candle/EWO series on **symbol, timeframe, and timestamp**.

---

## Data source: table and grain

| Item | Value |
|------|--------|
| **Table** | `wave_engine_state` |
| **Grain** | One row per (symbol, timeframe, timestamp) |
| **Primary key** | (symbol, timeframe, timestamp) |
| **Timestamp** | Same as candle open time (timestamptz; stored in ET context in this app) |

So for each candle you already plot (with EWO), there is at most one `wave_engine_state` row with the same `symbol`, `timeframe`, and `timestamp`. Use that row to drive labels, colors, or overlays.

---

## Schema: columns

| Column | Type | Description |
|--------|------|-------------|
| `symbol` | text | Instrument (e.g. same as your candle symbol). |
| `timeframe` | text | Timeframe code: `1M`, `1W`, `1D`, `360`, `90`, `23` (same as your chart timeframes). |
| `timestamp` | timestamptz | Candle time; join to your candle/EWO timestamp. |
| `trend_direction` | text | `UP` or `DOWN`. |
| `wave_number` | text | `3`, `4`, `5`, or `NONE`. |
| `wave_phase` | text | `IMPULSE`, `RETRACE`, or `NONE`. |
| `wave_start_time` | timestamptz | Start of the current wave (when wave 3 began); null when wave_number is NONE. |
| `wave_peak_ewo` | numeric | EWO at the current wave’s peak (so far); null when NONE. |
| `wave_peak_price` | numeric | Price (high) at the current wave’s peak; null when NONE. |
| `zero_cross_flag` | boolean | True on the bar where EWO crosses zero (e.g. transition into wave 4). |
| `new_n_high_flag` | boolean | True when wave 3 started because EWO made a new n-period high. |
| `retrace_trigger_flag` | boolean | True on the bar where wave 5 started (4→5: 5-period high and EWO > 0). |
| `engine_reset_flag` | boolean | True when the engine resets (e.g. trend flips down from wave 5). |

**Enums (for UI logic):**

- **trend_direction:** `UP` | `DOWN`
- **wave_number:** `3` | `4` | `5` | `NONE`
- **wave_phase:** `IMPULSE` | `RETRACE` | `NONE`

---

## Joining to your chart data

Your chart has a series per timeframe with at least: **timestamp** (or equivalent candle time), **EWO**, and optionally OHLC. The join is:

- **Chart series key:** (symbol, timeframe, timestamp)
- **Engine key:** (symbol, timeframe, timestamp)

So for each point in the EWO series, look up the row in `wave_engine_state` with the same symbol, timeframe, and timestamp. Use that row’s columns for:

- **Label / overlay:** e.g. “3”, “4”, “5” or “W3”, “W4”, “W5”; or color by `trend_direction` / `wave_phase`.
- **Markers:** e.g. show a marker when `zero_cross_flag`, `new_n_high_flag`, `retrace_trigger_flag`, or `engine_reset_flag` is true.
- **Reference levels:** optional use of `wave_peak_ewo` / `wave_peak_price` for horizontal lines or annotations at the current wave’s peak.

No extra aggregation: one engine row per candle, so no group-by needed for the overlay.

---

## Query patterns

**1. All engine state for one symbol and one timeframe (e.g. for a single chart):**

```sql
SELECT timestamp, trend_direction, wave_number, wave_phase,
       wave_peak_ewo, wave_peak_price,
       zero_cross_flag, new_n_high_flag, retrace_trigger_flag, engine_reset_flag
FROM wave_engine_state
WHERE symbol = :symbol
  AND timeframe = :timeframe
ORDER BY timestamp ASC;
```

**2. Same, with a date range (e.g. visible range):**

```sql
SELECT timestamp, trend_direction, wave_number, wave_phase,
       wave_peak_ewo, wave_peak_price,
       zero_cross_flag, new_n_high_flag, retrace_trigger_flag, engine_reset_flag
FROM wave_engine_state
WHERE symbol = :symbol
  AND timeframe = :timeframe
  AND timestamp >= :from_ts
  AND timestamp <= :to_ts
ORDER BY timestamp ASC;
```

**3. Join to candles (or EWO view) in SQL:**

If you query candles/EWO from a view that has `symbol`, `timeframe`, `timestamp` (e.g. `market_candles_ewo` or `vw_candles_with_ewo`), you can join in one query:

```sql
SELECT
  c.symbol,
  c.timeframe,
  c.timestamp,
  c.ewo,
  c.open, c.high, c.low, c.close,
  w.trend_direction,
  w.wave_number,
  w.wave_phase,
  w.wave_peak_ewo,
  w.wave_peak_price,
  w.zero_cross_flag,
  w.new_n_high_flag,
  w.retrace_trigger_flag,
  w.engine_reset_flag
FROM market_candles_ewo c   -- or vw_candles_with_ewo
LEFT JOIN wave_engine_state w
  ON w.symbol = c.symbol
 AND w.timeframe = c.timeframe
 AND w.timestamp = c.timestamp
WHERE c.symbol = :symbol
  AND c.timeframe = :timeframe
  AND c.timestamp >= :from_ts
  AND c.timestamp <= :to_ts
ORDER BY c.timestamp ASC;
```

Use `LEFT JOIN` so candles without engine state (e.g. before first run) still appear; wave columns will be null.

---

## HTTP API (optional)

If the chart app talks to this app’s API instead of the DB directly:

- **GET** `/api/wave-engine/state?symbol={symbol}&limit={limit}`  
  Returns recent `wave_engine_state` rows for the symbol (newest first; default limit 1000). The client can filter by timeframe and timestamp range in memory, or request a large limit and slice to the visible range.

Response shape: `{ data: Array<{ symbol, timeframe, timestamp, trend_direction, wave_number, wave_phase, ... }> }`.

The chart can request state once per symbol (and optionally per timeframe) and align rows to the EWO series by `timestamp`.

---

## Display suggestions (for the build team)

- **Wave number:** Show “3”, “4”, “5” (or “W3” etc.) at or above the EWO line for each bar, or color the EWO line/area by wave (e.g. 3 = one color, 4 = another, 5 = another, NONE = neutral).
- **Trend:** Optional color or label for UP vs DOWN (e.g. background tint or a small label).
- **Zero cross:** Draw a marker or vertical line when `zero_cross_flag` is true (typical wave 3→4 transition).
- **New N high:** Optional marker when `new_n_high_flag` is true (wave 3 start condition A).
- **Retrace trigger:** Optional marker when `retrace_trigger_flag` is true (wave 5 start).
- **Reset:** Optional marker or annotation when `engine_reset_flag` is true.

All timestamps are aligned to candle open time; no extra time alignment is required beyond matching on `timestamp`.

---

## How the table is populated

The table is filled by this app’s **wave engine runner**, not in real time. A run processes a chosen symbol (and optionally date range or lookback) and upserts into `wave_engine_state`. So:

- The chart should read from `wave_engine_state` only (no direct dependency on the runner).
- If a symbol/timeframe has no rows, either the engine has not been run for that symbol or there is no candle data for that range; the chart can show EWO without wave labels or treat wave columns as null.

---

## Summary for the build team

1. **Table:** `wave_engine_state`; one row per candle per (symbol, timeframe).
2. **Join key:** (symbol, timeframe, timestamp) to your existing EWO/candle series.
3. **Use:** trend_direction, wave_number, wave_phase for labels/colors; the four boolean flags for optional markers; wave_peak_ewo / wave_peak_price for optional reference levels.
4. **Query:** Filter by symbol and timeframe (and optional timestamp range); order by timestamp ASC for time-series display.
5. **Optional:** Use GET `/api/wave-engine/state?symbol=...` if the chart consumes this app’s API instead of the DB.

Example queries and schema details are also in [wave-engine-example-query.sql](wave-engine-example-query.sql) and the migration [supabase-portable/migrations/wave_engine_state.sql](../../supabase-portable/migrations/wave_engine_state.sql).
