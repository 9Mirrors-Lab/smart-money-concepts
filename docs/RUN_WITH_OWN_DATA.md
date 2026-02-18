# Running indicators on your own data

Use your own token or instrument OHLCV CSV (e.g. KCEX ETHUSDT) without touching the test data. The script `run_indicators.py` loads your CSV, runs all Smart Money Concepts indicators, and writes result CSVs to an output directory.

## Quick start

From the project root (with the package installed, e.g. in a venv):

```bash
python run_indicators.py "KCEX_ETHUSDT.P, 23_ce49b.csv"
```

Results are written to `output/KCEX_ETHUSDT_23m/`. To use a different output directory:

```bash
python run_indicators.py "KCEX_ETHUSDT.P, 23_ce49b.csv" --output my_results
```

## CSV format

Your CSV must have:

| Column  | Description                    |
|---------|--------------------------------|
| `time`  | Bar time as Unix timestamp (seconds) |
| `open`  | Open price                     |
| `high`  | High price                     |
| `low`   | Low price                      |
| `close` | Close price                    |
| `Volume` or `volume` | Volume  |

Extra columns (e.g. `Volume MA`, `ATR`) are ignored. The script normalizes column names to lowercase.

## Output files

The script produces one CSV per indicator in the output directory:

- `fvg.csv`, `fvg_consecutive.csv`
- `swing_highs_lows.csv`, `bos_choch.csv`, `ob.csv`, `liquidity.csv`, `retracements.csv`
- `previous_high_low_4h.csv`, `previous_high_low_1D.csv`, `previous_high_low_W.csv`
- `sessions_London.csv`

Each file has the same row index as your input (datetime), so you can join or plot against your OHLCV.

## Other timeframes (90m, 6h)

The library is timeframe-agnostic. For 90-minute or 6-hour data:

1. Use a CSV that already contains 90m or 6h bars (same columns: `time`, open, high, low, close, volume), or
2. Resample your 23m (or other) data in Python to 90m/6h, then pass the resulting DataFrame to the same indicators (e.g. by adding a second path in a small script that resamples and calls `run_all_indicators`).

Example resampling from 23m to 90m (run in your own script after loading the CSV):

```python
df = load_and_prepare("KCEX_ETHUSDT.P, 23_ce49b.csv")
df_90m = df.resample("90min").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}).dropna()
# Then run smc on df_90m and save to e.g. output/KCEX_ETHUSDT_90m/
```

Use a separate CSV or output folder per timeframe (e.g. `--output output/KCEX_ETHUSDT_6h`) so results stay organized.

## Supabase (market schema)

You can run indicators and export viewer JSON from **Supabase local** using the `market` schema tables.

**Tables:** `market.market_candles` (OHLCV) or `market.market_candles_ewo` (OHLCV + Elliott Wave Oscillator). Both have `symbol`, `timeframe`, `timestamp_utc`, and OHLCV columns; `market_candles_ewo` adds an `ewo` column.

**Setup (Supabase-local, market-candles / candles-with-fractals):** Set in your env or `.env`:

- `NEXT_PUBLIC_SUPABASE_MARKET_URL=http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY=<anon key>` (e.g. from `supabase status`)

**Run indicators from Supabase:**

```bash
python run_indicators.py --source supabase --symbol KCEX_ETHUSDT.P --timeframe 23
python run_indicators.py --source supabase --symbol KCEX_ETHUSDT.P --timeframe 1D --from 2025-01-01 --to 2025-02-01 --output output/my_run
```

Note: In `market_candles`, 23-minute data uses **timeframe `23`** (not `23m`). Use `1D`, `1M`, `23`, etc. as stored in the table.

**Live (API) – how the viewer gets data**

For live datasets (e.g. "KCEX ETH 23m (live)", "KCEX ETH 90m (live)"), the viewer **does not** use static JSON or the export script at runtime. It uses the **Live API**:

1. User selects a live dataset (e.g. "KCEX ETH 90m (live)").
2. Viewer fetches **`/api/smc-frames?symbol=KCEX_ETHUSDT.P&timeframe=90`** (or 23, 360, 1D).
3. The API **reads `public.smc_results`** in Supabase and returns `{ meta, frames }`.
4. The chart shows whatever is currently in the DB for that symbol/timeframe.

Wave labels come from **`/api/wave-engine/state`**, which reads **`wave_engine_state`** (same DB). No export script is run by the viewer; it only calls these APIs.

**Populating `smc_results`**

The table `smc_results` must be populated by your own process (pipeline, cron, or one-off). One way to do it is the export script. For step-by-step instructions when adding a **new** timeframe or **updating** an existing one, see [TIMEFRAME_STEPS.md](TIMEFRAME_STEPS.md).

```bash
python scripts/export_smc_frames.py --source supabase --symbol KCEX_ETHUSDT.P --timeframe 23 --last 500 --window 100 --save-to-db
```

Use `--all-timeframes` to refresh 23, 90, 360, 1D, 1W, and 1M in one go. The viewer then gets that data when it calls the API; you do not run the export script as part of viewing.

**Export viewer JSON to file (optional, for static datasets):**

```bash
python scripts/export_smc_frames.py --source supabase --symbol KCEX_ETHUSDT.P --timeframe 23 --last 500 --window 100
```

Exported JSON includes an `ewo` array per frame when the table has EWO values. In the smc-viewer, use the **Elliott Wave (EWO)** indicator toggle to show the oscillator on the chart (second y-axis on the left).

---

## Viewing the GIF with speed control

After generating a GIF (e.g. with `generate_gif.py`), open `tests/gif_viewer.html`. To make a larger or higher-resolution GIF, use `--width`, `--height`, and `--scale` (e.g. `--width 1000 --height 600 --scale 2` for 1000×600 layout at 2× pixel density). To export the chart as a **Plotly JSON file** so you can open and edit it in [Plotly Chart Studio](https://chart-studio.plotly.com/), add `--export-plotly chart.json`; the first frame’s figure is saved and can be imported in Chart Studio for further customization. in a browser. The page shows the GIF with a **Speed** slider (0.25× to 4×) and a **GIF** dropdown (e.g. `test_kcex.gif`, `test.gif`). Click **Load** to start.

To avoid CORS when loading the GIF, serve the `tests` folder locally, then open the viewer:

```bash
cd tests
python -m http.server 8080
```

Then open **http://localhost:8080/gif_viewer.html** in your browser. For a key to what each item on the chart means (FVG, BOS, OB, PH/PL, etc.), see [CHART_INDICATORS.md](CHART_INDICATORS.md).
