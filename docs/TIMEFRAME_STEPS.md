# Timeframe steps: new vs update

Steps for adding a **new** live timeframe and for **updating** an existing one.

---

## Adding a new timeframe

Prerequisite: candle data for that symbol + timeframe must exist in **`market.market_candles_ewo`** (your pipeline/cron populates this).

1. **Chart dropdown (datasets)**  
   Add an entry in `smc-viewer/public/data/datasets.json`:
   - `id`: e.g. `"1w-live"`
   - `path`: e.g. `"smc_frames_1w.json"` (used only when no `url`; live entries use `url`)
   - `label`: e.g. `"KCEX ETH 1W (live)"`
   - `url`: `"/api/smc-frames?symbol=KCEX_ETHUSDT.P&timeframe=1W"` (same symbol; timeframe value must match DB)

2. **Export panel (single TF + “All”)**  
   In `smc-viewer/components/export-panel.tsx`, add to `TIMEFRAME_OPTIONS`:
   - `{ value: "1W", label: "1W" }` (or the new TF code)
   - Update the “All” option label, e.g. `"All (23, 90, 360, 1D, 1W, 1M)"`.

3. **Export API success message**  
   In `smc-viewer/app/api/export-smc-frames/route.ts`, update the message when `allTimeframes` is true to list the new TF (e.g. include 1W, 1M).

4. **Export script (all-timeframes)**  
   In `scripts/export_smc_frames.py`:
   - Add to `out_by_tf`, e.g. `"1W": "smc_frames_1w.json"`, `"1M": "smc_frames_1m.json"`.
   - Add the new TF(s) to the loop: `for tf in ("23", "90", "360", "1D", "1W", "1M"):`.
   - Update the `--all-timeframes` help text to mention the new TFs.

5. **Populate `smc_results`**  
   Run the export so the new timeframe gets a row in `public.smc_results`:
   - **From the UI:** DB Export → choose the new TF (e.g. 1W) or “All” → Run export.
   - **From the repo root:**
     ```bash
     python scripts/export_smc_frames.py --source supabase --symbol KCEX_ETHUSDT.P --timeframe 1W --last 500 --window 100 --save-to-db
     ```
     Or refresh all: add `--all-timeframes` (and keep `--save-to-db`).

After that, the chart dropdown will show the new option and `/api/smc-frames?symbol=...&timeframe=1W` will return data from `smc_results`.

---

## Updating an existing timeframe

Refreshes SMC frames (and optional wave/SMA) for a symbol+timeframe already in the chart. No code changes.

**Option A – From the viewer (smc-viewer)**

1. Open the chart and select the live dataset for that timeframe (e.g. “KCEX ETH 23m (live)”).
2. Open **DB Export** (popover).
3. Set **Records (last N bars)** and **Window (bars per frame)**.
4. Set **Timeframe** to that TF (e.g. 23m) or **All (23, 90, 360, 1D, 1W, 1M)** to refresh every live TF.
5. Click **Run export**.

This calls `POST /api/export-smc-frames` with `symbol`, `timeframe` (or `allTimeframes`), `last`, `window`. The API runs `scripts/export_smc_frames.py` with `--source supabase --save-to-db`, which:

- Reads OHLCV (and EWO/SMA when available) from **`market.market_candles_ewo`** for that symbol+timeframe.
- Computes SMC indicators and builds the frames payload.
- Upserts one row into **`public.smc_results`** for that symbol+timeframe (`upsert_smc_results` in `smartmoneyconcepts/load_supabase.py`).

After it finishes, reload or switch timeframe in the chart; the viewer will fetch updated data from `/api/smc-frames`, which reads from `smc_results`.

**Option B – From the command line (repo root)**

Single timeframe:

```bash
python scripts/export_smc_frames.py --source supabase --symbol KCEX_ETHUSDT.P --timeframe 23 --last 500 --window 100 --save-to-db
```

All configured timeframes (23, 90, 360, 1D, 1W, 1M):

```bash
python scripts/export_smc_frames.py --source supabase --symbol KCEX_ETHUSDT.P --all-timeframes --last 500 --window 100 --save-to-db
```

Optional: `--from YYYY-MM-DD` and `--to YYYY-MM-DD` to limit the candle range.

---

## Data flow summary

| Step | New timeframe | Update existing |
|------|----------------|------------------|
| Candle source | Ensure `market.market_candles_ewo` has symbol+timeframe | Already present |
| Code | Add to datasets.json, export-panel, export API message, export_smc_frames.py | None |
| Populate/refresh | Run export (UI or CLI) with `--save-to-db` | Run export (UI or CLI) with `--save-to-db` |
| Viewer | Select new option; API reads `smc_results` | Reload or switch TF; API reads `smc_results` |

- **Live API:** `GET /api/smc-frames?symbol=...&timeframe=...` → reads **`public.smc_results`**.
- **Export script** (with `--source supabase --save-to-db`): reads **`market.market_candles_ewo`** → computes SMC → upserts **`public.smc_results`**.
