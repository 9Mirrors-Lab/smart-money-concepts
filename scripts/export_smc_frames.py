"""
Export SMC indicator frames to JSON for the interactive viewer.
Supports CSV or Supabase (market.market_candles_ewo) as data source.
"""
import argparse
import json
import os
import sys

import numpy as np
import pandas as pd

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)
from smartmoneyconcepts.smc import smc

DEFAULT_CSV = os.path.join(PROJECT_ROOT, "KCEX_ETHUSDT.P, 23_ce49b.csv")


def load_csv_data(csv_path: str) -> pd.DataFrame:
    """Load OHLCV CSV (time=Unix seconds, open/high/low/close/Volume); return DataFrame ready for smc."""
    df = pd.read_csv(csv_path)
    df = df.rename(columns={c: c.lower() for c in df.columns})
    if "time" not in df.columns:
        raise ValueError("CSV must have a 'time' column (Unix seconds)")
    ohlcv = ["open", "high", "low", "close", "volume"]
    for col in ohlcv:
        if col not in df.columns:
            raise ValueError(f"CSV must have column '{col}'")
    df = df[["time"] + ohlcv].copy()
    df = df.set_index("time")
    df.index = pd.to_datetime(df.index, unit="s")
    df = df.sort_index()
    return df


def nan_to_none(obj):
    """Recursively replace NaN/NaT with None for JSON serialization."""
    if isinstance(obj, dict):
        return {k: nan_to_none(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [nan_to_none(v) for v in obj]
    if isinstance(obj, (float, np.floating)) and np.isnan(obj):
        return None
    if pd.isna(obj):
        return None
    if isinstance(obj, (np.integer, np.int64)):
        return int(obj)
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    return obj


def dataframe_to_list_dict(df: pd.DataFrame) -> dict:
    """Convert DataFrame to dict of lists, with NaN -> null and index handled."""
    d = df.to_dict(orient="list")
    return nan_to_none(d)


def main():
    parser = argparse.ArgumentParser(
        description="Export SMC indicator frames to JSON for the interactive viewer."
    )
    parser.add_argument(
        "csv",
        nargs="?",
        default=None,
        help=f"Path to CSV (default when --source csv: {DEFAULT_CSV})",
    )
    parser.add_argument(
        "--source",
        choices=("csv", "supabase"),
        default="csv",
        help="Data source: csv file or Supabase market.market_candles_ewo (default: csv)",
    )
    parser.add_argument(
        "--symbol",
        default=None,
        help="Symbol (required when --source supabase; e.g. KCEX_ETHUSDT.P)",
    )
    parser.add_argument(
        "--from",
        dest="from_date",
        default=None,
        metavar="YYYY-MM-DD",
        help="Start date for Supabase (optional)",
    )
    parser.add_argument(
        "--to",
        dest="to_date",
        default=None,
        metavar="YYYY-MM-DD",
        help="End date for Supabase (optional)",
    )
    parser.add_argument(
        "--last",
        type=int,
        default=500,
        help="Use last N bars for the animation (default: 500)",
    )
    parser.add_argument(
        "--window",
        type=int,
        default=100,
        help="Sliding window size in bars (default: 100)",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output JSON path (default: smc-viewer/public/data/smc_frames.json or public/data/smc_frames.json)",
    )
    parser.add_argument(
        "--timeframe",
        default="23",
        help="Timeframe: use 23 for 23m, 1D, 1M, etc. (default: 23)",
    )
    parser.add_argument(
        "--save-to-db",
        action="store_true",
        help="Upsert result into public.smc_results (only when --source supabase).",
    )
    parser.add_argument(
        "--all-timeframes",
        action="store_true",
        help="Export 23, 90, 360, 1D, 1W, 1M in sequence (supabase only). Use with --save-to-db to refresh all live datasets with wave/SMA data.",
    )
    args = parser.parse_args()

    if args.all_timeframes and args.source == "supabase":
        if not args.symbol:
            sys.exit("--symbol is required when --source supabase")
        import subprocess
        viewer_public = os.path.join(PROJECT_ROOT, "smc-viewer", "public", "data")
        if not os.path.isdir(os.path.join(PROJECT_ROOT, "smc-viewer")):
            viewer_public = os.path.join(PROJECT_ROOT, "public", "data")
        out_by_tf = {"23": "smc_frames.json", "90": "smc_frames_90.json", "360": "smc_frames_360.json", "1D": "smc_frames_1d.json", "1W": "smc_frames_1w.json", "1M": "smc_frames_1m.json"}
        for tf in ("23", "90", "360", "1D", "1W", "1M"):
            cmd = [
                sys.executable, os.path.join(PROJECT_ROOT, "scripts", "export_smc_frames.py"),
                "--source", "supabase", "--symbol", args.symbol, "--timeframe", tf,
                "--last", str(args.last), "--window", str(args.window),
                "--out", os.path.join(viewer_public, out_by_tf[tf]),
            ]
            if args.from_date:
                cmd.extend(["--from", args.from_date])
            if args.to_date:
                cmd.extend(["--to", args.to_date])
            if args.save_to_db:
                cmd.append("--save-to-db")
            subprocess.run(cmd, cwd=PROJECT_ROOT, check=True)
        return

    ewo_list = sma5_list = sma35_list = timestamp_str_list = None
    if args.source == "supabase":
        if not args.symbol:
            sys.exit("--symbol is required when --source supabase")
        from smartmoneyconcepts.load_supabase import load_candles_ewo
        df, ewo_list, sma5_list, sma35_list, timestamp_str_list = load_candles_ewo(
            args.symbol,
            args.timeframe,
            from_date=args.from_date,
            to_date=args.to_date,
        )
        if len(df) == 0:
            sys.exit("No rows returned from Supabase; check symbol, timeframe, and date range")
        symbol = args.symbol
        df = df.iloc[-args.last :]
    else:
        csv_path = args.csv or DEFAULT_CSV
        if not os.path.isfile(csv_path):
            sys.exit(f"CSV not found: {csv_path}")
        df = load_csv_data(csv_path)
        df = df.iloc[-args.last :]
        symbol = os.path.splitext(os.path.basename(csv_path))[0].split(",")[0].strip()

    if len(df) < args.window:
        msg = f"Need at least {args.window} bars; got {len(df)}. Skipping this timeframe."
        print(msg, file=sys.stderr)
        sys.exit(0)

    if args.out:
        out_path = args.out
    else:
        viewer_public = os.path.join(PROJECT_ROOT, "smc-viewer", "public", "data")
        if os.path.isdir(os.path.join(PROJECT_ROOT, "smc-viewer")):
            os.makedirs(viewer_public, exist_ok=True)
            out_path = os.path.join(viewer_public, "smc_frames.json")
        else:
            os.makedirs(os.path.join(PROJECT_ROOT, "public", "data"), exist_ok=True)
            out_path = os.path.join(PROJECT_ROOT, "public", "data", "smc_frames.json")

    frames = []
    for pos in range(args.window, len(df)):
        window_df = df.iloc[pos - args.window : pos]

        fvg_data = smc.fvg(window_df, join_consecutive=True)
        swing_highs_lows_data = smc.swing_highs_lows(window_df, swing_length=5)
        bos_choch_data = smc.bos_choch(window_df, swing_highs_lows_data)
        ob_data = smc.ob(window_df, swing_highs_lows_data)
        liquidity_data = smc.liquidity(window_df, swing_highs_lows_data)
        previous_high_low_data = smc.previous_high_low(window_df, time_frame="4h")
        sessions_asia = smc.sessions(window_df, session="Asia")
        sessions_london = smc.sessions(window_df, session="London")
        sessions_nyam = smc.sessions(window_df, session="NYAM")
        sessions_nypm = smc.sessions(window_df, session="NYPM")

        # Sessions use time-of-day; daily+ bars are at midnight, so all fall into
        # overnight sessions (e.g. NYPM 19:00-01:00). Disable sessions for daily+.
        daily_timeframes = {"1D", "1d", "1W", "1w", "1M", "1m", "D", "W", "M"}
        if args.timeframe in daily_timeframes:
            sessions_asia["Active"] = 0
            sessions_london["Active"] = 0
            sessions_nyam["Active"] = 0
            sessions_nypm["Active"] = 0

        retracements_data = smc.retracements(window_df, swing_highs_lows_data)

        # Use raw timestamp strings from API when available (no conversion); matches wave_engine_state format
        start = pos - args.window
        if timestamp_str_list is not None:
            x_list = timestamp_str_list[start:pos]
            frame_ts = timestamp_str_list[pos - 1] if pos <= len(timestamp_str_list) else window_df.index[-1].isoformat()
        else:
            x_list = [t.isoformat() for t in window_df.index]
            frame_ts = window_df.index[-1].isoformat()

        frame = {
            "index": len(frames),
            "timestamp": frame_ts,
            "ohlc": {
                "x": x_list,
                "open": nan_to_none(window_df["open"].tolist()),
                "high": nan_to_none(window_df["high"].tolist()),
                "low": nan_to_none(window_df["low"].tolist()),
                "close": nan_to_none(window_df["close"].tolist()),
            },
            "fvg": dataframe_to_list_dict(fvg_data),
            "swingHighsLows": dataframe_to_list_dict(swing_highs_lows_data),
            "bosChoch": dataframe_to_list_dict(bos_choch_data),
            "ob": dataframe_to_list_dict(ob_data),
            "liquidity": dataframe_to_list_dict(liquidity_data),
            "previousHighLow": dataframe_to_list_dict(previous_high_low_data),
            "sessions": {
                "asia": dataframe_to_list_dict(sessions_asia),
                "london": dataframe_to_list_dict(sessions_london),
                "nyam": dataframe_to_list_dict(sessions_nyam),
                "nypm": dataframe_to_list_dict(sessions_nypm),
            },
            "retracements": dataframe_to_list_dict(retracements_data),
        }
        if ewo_list is not None:
            frame["ewo"] = nan_to_none(ewo_list[start:pos])
        if sma5_list is not None:
            frame["sma5"] = nan_to_none(sma5_list[start:pos])
        if sma35_list is not None:
            frame["sma35"] = nan_to_none(sma35_list[start:pos])
        frames.append(frame)

    payload = {
        "meta": {
            "symbol": symbol,
            "timeframe": args.timeframe,
            "windowSize": args.window,
            "barCount": len(frames),
        },
        "frames": frames,
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"Exported {len(frames)} frames to {out_path}")

    if args.save_to_db and args.source == "supabase":
        from smartmoneyconcepts.load_supabase import upsert_smc_results
        upsert_smc_results(symbol, args.timeframe, payload["meta"], payload["frames"])
        print(f"Saved to public.smc_results ({symbol}, {args.timeframe})")


if __name__ == "__main__":
    main()
