#!/usr/bin/env python3
"""
Run Smart Money Concepts indicators on OHLCV from CSV or Supabase.

Usage:
  python run_indicators.py [path_to_csv] [--output DIR]
  python run_indicators.py --source supabase --symbol KCEX_ETHUSDT.P --timeframe 23 [--from YYYY-MM-DD] [--to YYYY-MM-DD]

- CSV must have columns: time (Unix seconds), open, high, low, close, Volume.
- Supabase: uses market.market_candles (or market_candles_ewo). Set SUPABASE_URL and SUPABASE_ANON_KEY.
- Output: indicator result CSVs written to --output directory.
"""

import argparse
import os
import sys

import pandas as pd

# project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
from smartmoneyconcepts.smc import smc

OHLCV = ["open", "high", "low", "close", "volume"]
SWING_LENGTH = 5


def load_and_prepare(csv_path: str) -> pd.DataFrame:
    """Load CSV and return DataFrame ready for smc: datetime index, ohlcv columns."""
    if not os.path.isfile(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)

    # Normalize column names (smc expects lowercase; allow 'Volume' -> 'volume')
    df = df.rename(columns={c: c.lower() for c in df.columns})

    # Require time + ohlcv
    if "time" not in df.columns:
        raise ValueError("CSV must have a 'time' column (Unix seconds)")
    for col in OHLCV:
        if col not in df.columns:
            raise ValueError(f"CSV must have column '{col}' (or 'Volume' -> 'volume')")

    # Use only ohlcv for smc
    use = ["time"] + OHLCV
    df = df[[c for c in use if c in df.columns]].copy()
    df = df.set_index("time")
    df.index = pd.to_datetime(df.index, unit="s")
    df = df.sort_index()

    return df


def run_all_indicators(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Run all smc indicators used in the test suite; return dict of name -> DataFrame."""
    swing = smc.swing_highs_lows(df, swing_length=SWING_LENGTH)

    return {
        "fvg": smc.fvg(df),
        "fvg_consecutive": smc.fvg(df, join_consecutive=True),
        "swing_highs_lows": swing,
        "bos_choch": smc.bos_choch(df, swing),
        "ob": smc.ob(df, swing),
        "liquidity": smc.liquidity(df, swing),
        "previous_high_low_4h": smc.previous_high_low(df, time_frame="4h"),
        "previous_high_low_1D": smc.previous_high_low(df, time_frame="1D"),
        "previous_high_low_W": smc.previous_high_low(df, time_frame="W"),
        "sessions_London": smc.sessions(df, session="London"),
        "retracements": smc.retracements(df, swing),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Run SMC indicators on OHLCV from CSV or Supabase and write result CSVs."
    )
    parser.add_argument(
        "csv",
        nargs="?",
        default=None,
        help="Path to CSV (default when --source csv: KCEX_ETHUSDT.P, 23_ce49b.csv)",
    )
    parser.add_argument(
        "--source",
        choices=("csv", "supabase"),
        default="csv",
        help="Data source (default: csv)",
    )
    parser.add_argument(
        "--symbol",
        default=None,
        help="Symbol when --source supabase (e.g. KCEX_ETHUSDT.P)",
    )
    parser.add_argument(
        "--timeframe",
        default="23",
        help="Timeframe when using Supabase: 23 for 23m, 1D, 1M, etc. (default: 23)",
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
        "--output",
        "-o",
        default=None,
        help="Output directory for result CSVs",
    )
    args = parser.parse_args()

    if args.source == "supabase":
        if not args.symbol:
            sys.exit("--symbol is required when --source supabase")
        from smartmoneyconcepts.load_supabase import load_candles
        print("Loading from Supabase (market.market_candles)...")
        df = load_candles(
            args.symbol,
            args.timeframe,
            from_date=args.from_date,
            to_date=args.to_date,
        )
        if len(df) == 0:
            sys.exit("No rows from Supabase; check symbol, timeframe, and date range")
        out_dir = os.path.abspath(
            args.output or os.path.join(SCRIPT_DIR, "output", f"{args.symbol}_{args.timeframe}")
        )
    else:
        csv_path = os.path.abspath(args.csv or os.path.join(SCRIPT_DIR, "KCEX_ETHUSDT.P, 23_ce49b.csv"))
        if not os.path.isfile(csv_path):
            sys.exit(f"CSV not found: {csv_path}")
        out_dir = os.path.abspath(
            args.output or os.path.join(SCRIPT_DIR, "output", "KCEX_ETHUSDT_23m")
        )
        print(f"Loading: {csv_path}")
        df = load_and_prepare(csv_path)

    print(f"Rows: {len(df)}, index: {df.index.min()} -> {df.index.max()}")

    print("Running indicators...")
    results = run_all_indicators(df)

    os.makedirs(out_dir, exist_ok=True)
    for name, data in results.items():
        out_path = os.path.join(out_dir, f"{name}.csv")
        data.to_csv(out_path)
        print(f"  {out_path}")

    print(f"Done. {len(results)} result files in {out_dir}")


if __name__ == "__main__":
    main()
