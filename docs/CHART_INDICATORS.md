# Chart indicators: what you see on the GIF

The candlestick chart produced by `tests/generate_gif.py` (and shown in the [GitHub README](https://github.com/joshyattridge/smart-money-concepts)) overlays several Smart Money Concepts. This page explains **what each visual element is** and **what it means**. For how each is computed, see [INDICATOR_LOGIC.md](INDICATOR_LOGIC.md).

---

## Candles

- **Green candles:** Bullish (close > open).
- **Red candles:** Bearish (close < open).

---

## Fair value gap (FVG)

- **What you see:** Yellow (or yellowish) **rectangular zones** with the label **"FVG"**.
- **Meaning:** A price gap: the previous candle’s high is below the next candle’s low (bullish FVG), or the previous candle’s low is above the next candle’s high (bearish FVG). The zone is the gap between those levels. Often treated as potential support (bullish) or resistance (bearish) until **mitigated** (price trades through the zone).
- **On the chart:** The rectangle spans from the FVG candle to the candle that mitigated it (or to the end of the window if not yet mitigated).

---

## Swing highs and lows

- **What you see:** **Lines connecting swing points** — **green** for swing lows, **red** for swing highs.
- **Meaning:** A **swing high** is a bar whose high is the highest in a window of bars before and after. A **swing low** is a bar whose low is the lowest in that window. They mark local turning points and structure (higher highs/lows or lower highs/lows).
- **On the chart:** Segments between consecutive swing points; color indicates whether the segment starts at a swing high (red) or swing low (green).

---

## Break of structure (BOS) and change of character (CHoCH)

- **What you see:** Horizontal **lines at the broken level** with labels **"BOS"** (orange) or **"CHOCH"** (blue).
- **Meaning:**  
  - **BOS:** Price breaks a prior swing high (bullish) or swing low (bearish) in the direction of the trend — continuation of structure.  
  - **CHoCH:** A break that signals a possible **reversal** (e.g. break of a prior high in a downtrend).  
- **On the chart:** The line runs from the bar where the break was detected to the bar where the level was actually broken; the label sits near that level.

---

## Order blocks (OB)

- **What you see:** **Rectangular zones** with the label **"OB"** and text like **"1.335k (19.0%)"** or **"743.98 (32.0%)"**.
- **Meaning:** The last opposing candle before a strong move (e.g. the last down candle before price closed above a swing high). The zone is that candle’s high–low range. The **number** is related to volume (e.g. OBVolume); the **percentage** is a strength measure (min/max volume ratio). Often used as potential support (bullish OB) or resistance (bearish OB).
- **On the chart:** The rectangle shows the OB’s top and bottom; the label shows volume and strength.

---

## Liquidity

- **What you see:** **Horizontal line(s)** at a level, sometimes with a **"Liquidity"** label and a **"Liquidity Swept"** label with a **red diagonal** line.
- **Meaning:** **Liquidity** = multiple swing highs (or swing lows) clustered within a small price range — often where stops or orders sit. **Liquidity swept** = price has traded through that level (e.g. stop runs). The red line indicates the sweep.
- **On the chart:** Level = average of the clustered swing highs or lows; “Liquidity Swept” marks when and where price swept that level.

---

## Previous high and low (PH / PL)

- **What you see:** **White horizontal lines** with labels **"PH"** (previous high) or **"PL"** (previous low).
- **Meaning:** The **previous** period’s high or low for the chosen higher timeframe (e.g. 4h). Used as reference levels; **BrokenHigh** / **BrokenLow** in the data indicate when price has broken those levels.
- **On the chart:** PH/PL lines extend over the time range where that level is the “previous” high or low.

---

## Sessions

- **What you see:** **Shaded vertical band(s)** (e.g. over the London session).
- **Meaning:** Candles that fall inside the selected session (Sydney, Tokyo, London, New York, or a kill zone). Session high/low can be tracked over that window.
- **On the chart:** The shaded area shows when the session is “active.”

---

## Retracements

- **What you see:** **Percentages** near swing points, e.g. **"C:175.9%"** and **"D:175.9%"** or **"C:43.9%"**, **"D:36.3%"**.
- **Meaning:** **C** = **current retracement %** from the last swing high or low (how far price has retraced from that level). **D** = **deepest retracement %** in that swing leg. Gives a sense of pullback depth (e.g. 50%, 61.8%).
- **On the chart:** Shown at or near the swing point; direction (bullish/bearish) comes from whether you’re measuring from a swing high or low.

---

## Quick reference

| On the chart        | Abbreviation / label | Meaning |
|---------------------|----------------------|--------|
| Yellow zone         | FVG                  | Fair value gap (gap between candles) |
| Green/red segments  | (no label)           | Swing highs and lows (structure) |
| Orange line + text  | BOS                  | Break of structure (continuation) |
| Blue line + text    | CHOCH                | Change of character (reversal) |
| Rect zone + text    | OB + volume %        | Order block (last opposing candle zone + strength) |
| Horizontal line    | Liquidity / Liquidity Swept | Liquidity level and when it was swept |
| White lines        | PH, PL               | Previous high, previous low (higher timeframe) |
| Shaded band        | (session)            | Trading session (e.g. London) |
| Percentages        | C: …%  D: …%        | Current and deepest retracement % |

For the exact rules used to compute each of these, see [INDICATOR_LOGIC.md](INDICATOR_LOGIC.md). For API usage, see the main [README](../README.md).
