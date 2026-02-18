# Indicator logic (this project)

This document describes the **exact logic** used in `smartmoneyconcepts/smc.py` to identify each concept. All references are to that file.

---

## Context7 (MCP) summary

Queries were run against **Context7** with library ID **`/joshyattridge/smart-money-concepts`** (Smart Money Concepts Python library; High reputation). Context7 surfaces README-level descriptions. Below is the logic as summarized by Context7; the sections that follow add implementation detail from the source code.

| Concept | Context7 logic summary |
|--------|-------------------------|
| **Fair value gap (FVG)** | FVG when previous high &lt; next low (bullish) or previous low &gt; next high (bearish). Option to merge consecutive FVGs. |
| **Swing highs and lows** | Swing high = highest high in lookback + forward period (`swing_length`). Swing low = lowest low in that period. |
| **BOS / CHoCH** | Break of structure and change of character indicate shifts in market structure. Detection can use candle closes or highs/lows (`close_break`). |
| **Order blocks (OB)** | Price ranges with high volume of market orders. Mitigation by close or by high/low (`close_mitigation`). Strength (percentage) is calculated. |
| **Liquidity** | Multiple highs or lows within a small price range (`range_percent`). Identifies bullish/bearish liquidity and the candle that swept them. |
| **Previous high and low** | Previous high/low for the given `time_frame`. Returns whether price has broken those levels. |
| **Sessions** | Candles inside a session (Sydney, Tokyo, London, New York, kill zones, or custom start/end). Supports time zone. |
| **Retracements** | Retracement % from swing highs or lows; direction and depth. Input: swing high/low DataFrame. |

**API references from Context7:**

- `smc.fvg(ohlc, join_consecutive=False)`
- `smc.swing_highs_lows(ohlc, swing_length=50)`
- `smc.bos_choch(ohlc, swing_highs_lows, close_break=True)`
- `smc.ob(ohlc, swing_highs_lows, close_mitigation=False)`
- `smc.liquidity(ohlc, swing_highs_lows, range_percent=0.01)`
- `smc.previous_high_low(ohlc, time_frame="1D")`
- `smc.sessions(ohlc, session, start_time="", end_time="", time_zone="UTC")`
- `smc.retracements(ohlc, swing_highs_lows)`

---

## Fair value gap (FVG)

**Method:** `smc.fvg(ohlc, join_consecutive=False)`

**Logic:**

- **Bullish FVG:** Current candle is bullish (close > open) **and** previous candle’s high is **below** next candle’s low. Gap is between previous high and next low.
- **Bearish FVG:** Current candle is bearish (close < open) **and** previous candle’s low is **above** next candle’s high. Gap is between next high and previous low.

**Output:** FVG = 1 (bullish) or -1 (bearish), Top, Bottom, MitigatedIndex.

**Mitigation:** For bullish FVG, mitigated when a subsequent candle’s **low** ≤ Top (first such candle). For bearish FVG, mitigated when a subsequent candle’s **high** ≥ Bottom. Mitigation is checked from two candles after the FVG candle.

**Optional:** If `join_consecutive=True`, consecutive same-direction FVGs are merged into one zone (max of tops, min of bottoms); only the last index of the run is kept.

---

## Swing highs and lows

**Method:** `smc.swing_highs_lows(ohlc, swing_length=50)`

**Logic:**

- **Swing high:** Bar where the current **high** equals the **maximum high** over a window of `swing_length` bars **before** and `swing_length` bars **after** (implementation uses `swing_length*2` for the rolling window and a shift so the center bar is compared to the rolling max/min).
- **Swing low:** Bar where the current **low** equals the **minimum low** over the same symmetric window.

**Cleanup:**  
- If two consecutive swing highs appear, the lower one is removed; if two consecutive swing lows, the higher one is removed. This is repeated until no such consecutive pairs remain.  
- The first and last swing points are then forced to alternate: if the first remaining swing is a high, a low is inserted at index 0; if the last is a low, a high is inserted at the end (and vice versa).

**Output:** HighLow = 1 (swing high) or -1 (swing low), Level = that bar’s high or low.

---

## Break of structure (BOS) and change of character (CHoCH)

**Method:** `smc.bos_choch(ohlc, swing_highs_lows, close_break=True)`

**Input:** The swing highs/lows series (sequence of levels and HighLow ±1).

**Logic (four most recent swing points):**

- **Bullish BOS:** Last four swings are low, high, low, high **and** levels form **higher lows and higher highs**:  
  `level[-4] < level[-2] < level[-3] < level[-1]`.  
  BOS is assigned at the **third** swing (the low before the last high). Level = that swing’s level (the broken high).
- **Bearish BOS:** Last four swings are high, low, high, low **and** levels form **lower highs and lower lows**:  
  `level[-4] > level[-2] > level[-3] > level[-1]`.  
  Same idea at the third swing; level = broken low.

- **Bullish CHoCH:** Same swing pattern [-1, 1, -1, 1] but **reversal** in structure:  
  `level[-1] > level[-3] > level[-4] > level[-2]` (last high above previous high; structure shift).  
  Assigned at third swing; level = level[-3].
- **Bearish CHoCH:** Pattern [1, -1, 1, -1] with  
  `level[-1] < level[-3] < level[-4] < level[-2]`.  
  Assigned at third swing; level = level[-3].

**Break detection:** After assigning BOS/CHoCH, for each such event the code finds the first **later** candle where price breaks the level:  
- Bullish: close (or high if `close_break=False`) > level.  
- Bearish: close (or low if `close_break=False`) < level.  
If an earlier BOS/CHoCH’s break index is ≥ a later break index, the earlier one is removed. Any BOS/CHoCH that is never broken is removed.

**Output:** BOS, CHOCH (1 or -1), Level, BrokenIndex.

---

## Order blocks (OB)

**Method:** `smc.ob(ohlc, swing_highs_lows, close_mitigation=False)`

**Logic:**

- **Bullish OB:** When price **closes above** a **swing high**, look back from the candle that closed above to the swing high. The bullish OB is the **last candle before that close** that has the **lowest low** in the range from (swing high index + 1) to (close index − 1). That candle’s high/low become Top/Bottom. If no such candle, use the previous bar’s high/low. OB is **mitigated** when a later candle’s low goes below the OB bottom (or, if `close_mitigation=True`, when the min(open, close) goes below bottom). If after mitigation price trades above the OB top, that OB is invalidated and removed.
- **Bearish OB:** When price **closes below** a **swing low**, look back for the candle with the **highest high** in the range between the swing low and the close. That candle’s high/low become Top/Bottom. Mitigation = later candle’s high above Top (or max(open, close) above top if `close_mitigation=True`). Invalidation if price later trades below the OB bottom.

**Volume:** OBVolume = volume of the breaking candle + previous two candles. Percentage = 100 × min(highVolume, lowVolume) / max(highVolume, lowVolume) where highVolume/lowVolume are derived from that 3-candle volume split (implementation splits current+prev1 vs prev2 for bullish, and prev2 vs current+prev1 for bearish).

**Output:** OB = 1 or -1, Top, Bottom, OBVolume, MitigatedIndex, Percentage.

---

## Liquidity

**Method:** `smc.liquidity(ohlc, swing_highs_lows, range_percent=0.01)`

**Logic:**

- **Range:** `pip_range = (max(high) - min(low)) * range_percent` over the full series.
- **Bullish liquidity:** Among **swing highs** (HighLow == 1), group those whose Level lies within `pip_range` of each other (range = level ± pip_range). For each group (more than one swing high in range), record: Liquidity = 1, Level = average of those levels, End = index of last swing in the group. **Swept** = first candle **after** the first swing in the group whose **high** ≥ (first swing level + pip_range). Once a swing high is used in a group, it is not reused.
- **Bearish liquidity:** Same idea on **swing lows** (HighLow == -1): group lows within pip_range; Level = average; Swept = first candle whose **low** ≤ (first swing level − pip_range).

**Output:** Liquidity = 1 or -1, Level, End, Swept.

---

## Previous high and low

**Method:** `smc.previous_high_low(ohlc, time_frame="1D")`

**Logic:**

- **Resample** OHLCV to `time_frame` (e.g. "4h", "1D", "W") with open=first, high=max, low=min, close=last, volume=sum.
- For each **original** candle, determine which resampled period it belongs to (by bar time). **PreviousHigh** / **PreviousLow** = the high and low of the **second-to-last completed** resampled period (i.e. the “previous” period before the current one).
- **BrokenHigh:** Within the same “current” resampled period, track cumulative max of candle highs; set BrokenHigh = 1 when this cumulative high > PreviousHigh.
- **BrokenLow:** Track cumulative min of candle lows; set BrokenLow = 1 when this cumulative low < PreviousLow.

**Output:** PreviousHigh, PreviousLow, BrokenHigh, BrokenLow (one row per original bar).

---

## Sessions

**Method:** `smc.sessions(ohlc, session=..., start_time="", end_time="", time_zone="UTC")`

**Logic:**

- Index is converted to datetime and optionally to the given `time_zone` (then to UTC internally). For each bar, the **time-of-day** (HH:MM) is compared to the session’s start/end.
- **Active = 1** if the bar’s time falls inside the session window (handles overnight sessions where start > end). Predefined sessions (Sydney, Tokyo, London, New York, Asian kill zone, London open kill zone, New York kill zone, London close kill zone) use fixed start/end times; "Custom" uses `start_time` and `end_time`.
- **High:** For bars where Active=1, High = running max of bar high (reset when leaving session). **Low:** Running min of bar low in session.

**Output:** Active (0/1), High, Low.

---

## Retracements

**Method:** `smc.retracements(ohlc, swing_highs_lows)`

**Logic:**

- Walk bars in order. When a **swing high** is seen, set Direction = 1 and store Level = that high (as “top”). When a **swing low** is seen, set Direction = -1 and store Level = that low (as “bottom”). Otherwise keep previous direction.
- **Current retracement (bullish phase):** After a swing high, current retracement % = `100 - (low - bottom) / (top - bottom) * 100` (how far price has retraced down from the high toward the last low). **Deepest retracement** = max of current retracement over that swing-high segment.
- **Current retracement (bearish phase):** After a swing low, current retracement % = `100 - (high - top) / (bottom - top) * 100`; deepest is tracked similarly.
- Results are shifted by one bar and the first few retracements (until direction has changed three times) are zeroed to avoid bad initial values.

**Output:** Direction (1/-1), CurrentRetracement%, DeepestRetracement%.

---

## Summary table

| Concept        | Main inputs        | Identification rule |
|----------------|--------------------|----------------------|
| FVG            | OHLC               | Gap: prev high < next low (bullish) or prev low > next high (bearish); current candle direction matches. |
| Swing high/low | OHLC, swing_length | Bar is local max of high or min of low over symmetric window; consecutive same-type cleaned. |
| BOS/CHoCH      | Swing highs/lows   | Last 4 swings: specific pattern and level ordering; break and cleanup by later price. |
| Order block    | OHLC, swing H/L    | After close above swing high (bullish) or below swing low (bearish); OB = extreme candle in between; mitigation by later price. |
| Liquidity      | OHLC, swing H/L    | Swing highs (or lows) within range_percent of each other; swept when price exceeds range. |
| Previous H/L   | OHLC, time_frame   | Resample to TF; previous period’s high/low; broken when cum max/min crosses that level. |
| Sessions       | OHLC, session name | Bar time inside session start–end (timezone-aware). |
| Retracements   | OHLC, swing H/L    | Between swing high and swing low; retracement % from last swing level. |
