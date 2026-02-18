"""
Load OHLCV and EWO from Supabase local.

- load_candles_ewo: reads from market_candles_ewo (OHLCV + ewo, sma_5, sma_35).
  Wave data is fetched by the viewer from GET /api/wave-engine/state (same approach as EWO from API).
- load_candles: reads from market_candles (OHLCV only).

Set NEXT_PUBLIC_SUPABASE_MARKET_URL and NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request


def _fetch(
    base_url: str,
    anon_key: str,
    table: str,
    *,
    symbol: str,
    timeframe: str,
    from_ts: int | None = None,
    to_ts: int | None = None,
    from_iso: str | None = None,
    to_iso: str | None = None,
    order_col: str = "timestamp_utc",
    order_asc: bool = True,
    schema: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    """Fetch rows from Supabase REST. Use default (public) schema if schema is None.
    Supabase default limit is 1000; use order_asc=False and limit to get latest rows."""
    path = f"/rest/v1/{table}"
    order_dir = "asc" if order_asc else "desc"
    query = [
        ("symbol", f"eq.{symbol}"),
        ("timeframe", f"eq.{timeframe}"),
        ("order", f"{order_col}.{order_dir}"),
    ]
    if limit is not None:
        query.append(("limit", str(limit)))
    if from_ts is not None:
        query.append(("timestamp_utc", f"gte.{from_ts}"))
    if to_ts is not None:
        query.append(("timestamp_utc", f"lte.{to_ts}"))
    if from_iso is not None:
        query.append(("timestamp", f"gte.{from_iso}"))
    if to_iso is not None:
        query.append(("timestamp", f"lte.{to_iso}"))
    url = f"{base_url.rstrip('/')}{path}?{urllib.parse.urlencode(query)}"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Accept": "application/json",
    }
    if schema:
        headers["Accept-Profile"] = schema
        headers["Content-Profile"] = schema
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def load_candles_ewo(
    symbol: str,
    timeframe: str,
    *,
    from_date: str | None = None,
    to_date: str | None = None,
    from_ts: int | None = None,
    to_ts: int | None = None,
) -> "tuple[pd.DataFrame, list[float | None] | None, list[float | None] | None, list[float | None] | None, list[str] | None]":
    """
    Load candle + EWO + SMA from market_candles_ewo (single table: OHLCV + EWO).
    Wave data is not loaded here; the viewer fetches it from GET /api/wave-engine/state (same approach as EWO from API).

    Table columns: symbol, timeframe, timestamp, mean_price, sma_5, sma_35, ewo,
    open, high, low, close, volume.

    Returns (df, ewo_list, sma5_list, sma35_list, timestamp_str_list). ewo/sma5/sma35 aligned to rows or None.
    timestamp_str_list is the raw timestamp strings from the API (no conversion), so frame ohlc.x can match wave_engine_state.

    Date args: "YYYY-MM-DD". Timestamp args: Unix seconds.
    """
    import pandas as pd

    base_url = os.environ.get("NEXT_PUBLIC_SUPABASE_MARKET_URL") or os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
    anon_key = os.environ.get("NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
    if not anon_key:
        raise ValueError("Set NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY (or SUPABASE_ANON_KEY)")

    from_iso = to_iso = None
    if from_date or from_ts is not None:
        ts = pd.Timestamp(from_date) if from_ts is None else pd.Timestamp(from_ts, unit="s")
        from_iso = ts.isoformat()
    if to_date or to_ts is not None:
        ts = pd.Timestamp(to_date) if to_ts is None else pd.Timestamp(to_ts, unit="s")
        to_iso = ts.isoformat()

    # When no date filter, fetch latest rows first (Supabase REST often caps limit at 1000)
    if from_iso is None and to_iso is None:
        rows = _fetch(
            base_url,
            anon_key,
            "market_candles_ewo",
            symbol=symbol,
            timeframe=timeframe,
            order_col="timestamp",
            order_asc=False,
            limit=1000,
        )
        if rows:
            rows = list(reversed(rows))
    else:
        rows = _fetch(
            base_url,
            anon_key,
            "market_candles_ewo",
            symbol=symbol,
            timeframe=timeframe,
            from_iso=from_iso,
            to_iso=to_iso,
            order_col="timestamp",
        )
    if not rows:
        return pd.DataFrame(), None, None, None, None

    ohlcv = ["open", "high", "low", "close", "volume"]
    for c in ohlcv:
        if c not in rows[0]:
            raise ValueError(f"market_candles_ewo missing column: {c}")

    # Raw timestamp strings from API (same format as wave_engine_state); rows are order timestamp.asc, df keeps that order
    timestamp_str_list = [str(r.get("timestamp") or "") for r in rows]

    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.set_index("timestamp").sort_index()
    df = df[ohlcv].copy()

    def _float_list(key: str) -> list[float | None] | None:
        if key not in rows[0]:
            return None
        raw = [r.get(key) for r in rows]
        if all(v is None for v in raw):
            return None
        return [float(v) if v is not None else None for v in raw]

    ewo_list = _float_list("ewo")
    sma5_list = _float_list("sma_5")
    sma35_list = _float_list("sma_35")

    return df, ewo_list, sma5_list, sma35_list, timestamp_str_list


def load_candles(
    symbol: str,
    timeframe: str,
    *,
    from_date: str | None = None,
    to_date: str | None = None,
    from_ts: int | None = None,
    to_ts: int | None = None,
) -> "pd.DataFrame":
    """
    Load OHLCV from market.market_candles (no EWO).

    Returns DataFrame with datetime index and ohlcv columns, ready for smc.
    """
    import pandas as pd

    base_url = os.environ.get("NEXT_PUBLIC_SUPABASE_MARKET_URL") or os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
    anon_key = os.environ.get("NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
    if not anon_key:
        raise ValueError("Set NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY (or SUPABASE_ANON_KEY)")

    if from_date and from_ts is None:
        from_ts = int(pd.Timestamp(from_date).timestamp())
    if to_date and to_ts is None:
        to_ts = int(pd.Timestamp(to_date).timestamp() + 86400)

    rows = _fetch(
        base_url, anon_key, "market_candles",
        symbol=symbol, timeframe=timeframe, from_ts=from_ts, to_ts=to_ts,
    )
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df = df.rename(columns={"timestamp_utc": "time"})
    df = df.set_index("time")
    df.index = pd.to_datetime(df.index, unit="s")
    df = df.sort_index()
    ohlcv = ["open", "high", "low", "close", "volume"]
    return df[[c for c in ohlcv if c in df.columns]].copy()


def upsert_smc_results(
    symbol: str,
    timeframe: str,
    meta: dict,
    frames: list[dict],
) -> None:
    """
    Upsert computed SMC + EWO result into public.smc_results (one row per symbol/timeframe).
    Uses POST with Prefer: resolution=merge-duplicates for upsert.
    """
    base_url = os.environ.get("NEXT_PUBLIC_SUPABASE_MARKET_URL") or os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
    anon_key = os.environ.get("NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
    if not anon_key:
        raise ValueError("Set NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY (or SUPABASE_ANON_KEY)")

    from datetime import datetime, timezone
    url = f"{base_url.rstrip('/')}/rest/v1/smc_results"
    payload = {
        "symbol": symbol,
        "timeframe": timeframe,
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "meta": meta,
        "frames": frames,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {anon_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        if resp.status not in (200, 201, 204):
            raise RuntimeError(f"smc_results upsert failed: {resp.status}")
