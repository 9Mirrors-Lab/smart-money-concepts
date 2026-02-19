# Engine 2 (Elliott Wave Analyzer) — Logic and Steps Overview

Details below are pulled from the design and implementation dialogue in `ewo-chat.md` and appended under each section.

---

## Purpose (original intent)

Engine 2 was designed as a **probabilistic alignment and health layer**, not a signal generator.

Its job is to:

* Translate deterministic wave state (Engine 1) into **contextual market health**
* Answer *"Is this market structurally aligned, fragile, or late-stage?"*
* Act as a **permission and risk-filtering layer** for downstream execution logic

It deliberately avoids:

* Trade signals
* Directional predictions
* Optimization toward frequency

**From chat:**

* Plan: *"Probabilistic Alignment Engine (Engine 2)"* — alignment scores and confidence layer only; *"deterministic in calculation, probabilistic in interpretation."*
* Out of scope: *"No change to wave labels or deterministic state. No prediction of future candles; no ML/black-box models. Scoring and confidence layer only."*
* Interpretive layer: *"Interpretive layer only explains; it does not decide trades."* *"No forecasting, no signal generation, no trade direction."*
* Success criteria: trader answers in under ~3 seconds: *"Is this market healthy?"* → alignment_state + narrative; *"Am I early, mid, or late?"* → dominant_bias + phase; *"Is alignment broad or fragile?"* → confidence_level + key_factors.

---

## Initial logic design (baseline rules)

Engine 2 consumes:

* Alignment score (composite)
* Wave 3 probability
* Wave 5 exhaustion probability
* Multi-timeframe stack score
* Momentum strength
* Volatility regime
* Divergence health
* Wave context (number, phase, trend)

From these, it derives:

* **Alignment state**: STRONG / MODERATE / WEAK / DISALIGNED
* **Dominant bias**: CONTINUATION / EXHAUSTION / NEUTRAL
* **Confidence level**: HIGH / MEDIUM / LOW

Key characteristics of the logic:

* Conservative thresholds by design
* Explicit gating (states must be *earned*)
* NEUTRAL + LOW treated as valid baseline states

**From chat (exact rules):**

**Input (Engine 2):** One row combining: `alignment_score`, `wave3_probability`, `wave5_exhaustion_probability`, `momentum_strength_score`, `multi_tf_stack_score`, `volatility_regime_score`, `divergence_score` (health: higher = less divergence risk), plus wave context: `wave_number` (3 | 4 | 5 | NONE), `trend_direction`, `wave_phase`.

**Alignment state (from alignment_score):**

* ≥ 0.75 → STRONG  
* 0.55–0.74 → MODERATE  
* 0.35–0.54 → WEAK  
* &lt; 0.35 → DISALIGNED  

**Dominant bias:**

* CONTINUATION: `wave3_probability ≥ 0.60` and `wave_number === 3` and `momentum_strength_score ≥ 0.55`.
* EXHAUSTION: `wave5_exhaustion_probability ≥ 0.60` and `wave_number === 5` and divergence risk high (e.g. `divergence_score ≤ 0.50` → risk = 1 − divergence_score).
* Else NEUTRAL.

**Confidence:**

* HIGH: `multi_tf_stack_score ≥ 0.70` and `alignment_score ≥ 0.65`.
* MEDIUM: `multi_tf_stack_score ≥ 0.40`.
* Else LOW.

**Composite alignment_score (Engine 2 calculation):**  
`alignment_score = w1*momentum_strength_score + w2*multi_tf_stack_score + w3*volatility_regime_score + w4*divergence_score + w5*wave_context_weight`, with default weights (e.g. 0.30, 0.30, 0.15, 0.15, 0.10), sum = 1. Sub-scores 0–1.

**Divergence:** DB stores `divergence_score` as health (higher = less divergence risk). For warnings, use divergence risk = 1 − divergence_score (e.g. trigger when `divergence_score ≤ 0.4`).

---

## Interpretive layer (human-readable abstraction)

A pure interpretive layer was added to:

* Convert raw scores into **structured explanations**
* Produce consistent narrative summaries
* Surface *why* states fired or were blocked

Output contract:

* alignment_state
* dominant_bias
* confidence_level
* narrative_summary
* key_factors
* warnings

This layer is:

* Read-only
* Deterministic
* UI-agnostic

**From chat:**

* **Location:** e.g. `smc-viewer/lib/interpretation-engine.ts`. Single export: `interpret(scoresAndWave): MarketInterpretation`; no JSX, no DOM, no fetch.
* **Key factors:** 2–4 bullets from an allowed list; only include if relevance ≥ 0.6. Only one of "Multi-timeframe stack aligned" or "Higher timeframe misalignment" (stack ≥ 0.6 vs stack ≤ 0.4 with relevance ≥ 0.6). No duplicate concepts.
* **Warnings:** Only when (1) divergence risk ≥ 0.6 (`divergence_score ≤ 0.4`), or (2) `alignment_state === "STRONG"` and `confidence_level === "LOW"`, or (3) `wave_number === 5` and `volatility_regime_score < 0.4`. Example phrasing: "Divergence increasing against price highs", "Lower timeframe strength lacks higher timeframe confirmation", "Volatility contraction during Wave 5".
* **Narrative:** One sentence (max two lines), no hype/predictions; e.g. "Multi-timeframe structure is aligned in Wave 3 with expanding momentum and volatility." or "Market structure is mixed with limited timeframe agreement and muted momentum."
* **Global bias banner (multi-TF):** "Market in expansion phase" when STRONG ≥ 1 and CONTINUATION ≥ 2; "Late-stage / risk-aware conditions" when EXHAUSTION ≥ 2. Do not average scores; use counts and states only.

---

## UI integration (Engine 2 panel)

Engine 2 was integrated into the chart view as a **right-side alignment panel** with two modes:

### 1. Current bar

* Tied to the chart playhead
* Shows interpretation for the active bar
* Answers: *"What is the market state **right now**?"*

### 2. Multi-timeframe

* Shows latest interpretation per timeframe
* Adds a global bias banner (when justified)
* Answers: *"How aligned is the structure **across resolution**?"*

This panel is intentionally:

* Non-interactive (no tuning here)
* Narrative-first
* Focused on clarity over density

**From chat:**

* **Placement:** Right sidebar, 320px; "Engine 2" label, Multi-TF / Current bar toggle, then AlignmentPanel. Nexus-style: dark card, status chips (STRONG/MODERATE/WEAK/DISALIGNED and CONT/EXHAUSTION/NEUTRAL), CONF label, narrative, key factors, warnings.
* **Current bar:** Uses `meta.symbol`, `meta.timeframe`, `current.timestamp`. Fetches `GET /api/alignment-engine/interpretation?symbol=...&timeframe=...&timestamp=...`. One row from `wave_alignment_scores` + matching `wave_engine_state`, then `interpret()`; returns single MarketInterpretation.
* **Multi-TF:** Toggle fetches `GET /api/alignment-engine/interpretation?symbol=...&multiTf=1`; reads `vw_alignment_scores_latest_per_tf`, joins wave state per row; returns `{ interpretations, globalBiasBanner }`.
* **Display:** Alignment state chip (green → amber → orange → red), bias chip, CONF: HIGH | MEDIUM | LOW, narrative, 2–4 key factors, warnings when present. Empty state: "No alignment data. Run Engine 2 for this symbol and timeframe." No business logic in the panel; only renders the interpretation object.

---

## Problem discovered (critical insight)

During live use, a pattern emerged:

* Most bars resolved to **WEAK / LOW / NEUTRAL**
* STRONG and HIGH confidence rarely or never appeared
* Visual indicators (dots, badges) appeared "inactive"

Rather than tuning immediately, diagnostics were added.

**From chat:**

* User: *"The challenge is that the current logic does not light up the vertical dots. Out of 500 bars I saw one occasion that had 1D yellow and nothing else. A majority of the time the results are almost always low confidence."*
* User wanted to see *"every row and the details appended for the current card"* to see *"how often each option for the current code can show"* — i.e. unit-test style, count how many variations of the card are possible.
* Outcome: diagnostics showed e.g. 1W *"predominantly WEAK with LOW confidence"*, *"STRONG alignment does not occur under current rules"*, *"HIGH confidence does not occur under current rules"*; same pattern for 23m (e.g. WEAK 77.6%, STRONG 0%, HIGH/MEDIUM 0%, CONTINUATION 8.3%, EXHAUSTION 0.3%).

---

## Diagnostics expansion (system-level analysis)

A diagnostics drawer was introduced to inspect:

* Outcome distributions
* Rule gating frequencies
* Blocked vs reachable states
* Rare vs unreachable conditions

Key additions:

* Per-timeframe outcome distributions
* Gating / constraint grids
* Rare & unreachable state identification
* Current-bar rule firing vs blocking breakdown

This shifted analysis from **"why doesn’t this light up?"** to **"what is the system actually doing?"**

**From chat (exact structure):**

**Per-timeframe diagnostics (example: 1W, 23):**

* **Behavior summary:** e.g. "This timeframe is predominantly WEAK with LOW confidence."; "STRONG alignment does not occur under current rules."; "HIGH confidence does not occur under current rules."; optionally "CONTINUATION and EXHAUSTION are rare; NEUTRAL dominates."
* **What dominates:**  
  * Alignment state: WEAK (e.g. 70.86% / 77.6%) — Dominant [Expected] n=…; MODERATE — Transitional, short-lived; DISALIGNED — Structural conflict; STRONG (0%) — Unreachable under current rules [Unreachable] n=0.  
  * Confidence: LOW (e.g. 100%) — Default operating state [Overrepresented]; HIGH/MEDIUM (0%) — Unreachable.  
  * Dominant bias: NEUTRAL — Dominant; CONTINUATION — Transitional or Occasional; EXHAUSTION — Unreachable or Rare but reachable.
* **Why is it blocked?**  
  * Why STRONG never appears: e.g. `alignment_score < 0.75` → blocks 100%.  
  * Why HIGH confidence never appears: e.g. `multi_tf_stack_score < 0.7`, `multi_tf_stack_score < 0.4`, `alignment_score < 0.65` (with %).  
  * Why CONTINUATION is rare: e.g. `wave3_probability < 0.6`, `wave_number ≠ 3`, `momentum_strength_score < 0.55` with block percentages.  
  * Rare (valid but uncommon): e.g. `dominant_bias.EXHAUSTION`, Divergence warnings count.  
  * Unreachable (rule-locked): list e.g. `alignment_state.STRONG`, `confidence_level.HIGH`, `confidence_level.MEDIUM`, `dominant_bias.EXHAUSTION`.
* **Suggested interpretation:** e.g. "1W is operating as a confirmatory timeframe, not a signal generator." (Same for 23.)
* **Current bar breakdown:** Derived state (e.g. WEAK / NEUTRAL / LOW), raw scores (alignment, wave3, stack), **Fired:** which rules passed (e.g. `alignment_score ≥ 0.35 → WEAK`, `multi_tf_stack_score < 0.4 → LOW`, CONTINUATION/EXHAUSTION not met → NEUTRAL), **Blocked:** which rules failed (e.g. STRONG blocked by alignment_score < 0.75; HIGH by multi_tf_stack_score < 0.7 and alignment_score < 0.65; MEDIUM by multi_tf_stack_score < 0.4; CONTINUATION by wave3_probability < 0.6 and/or momentum_strength_score < 0.55).

Drawer: expand/collapse, slide-out tray; ability to run predefined queries (all or one), filter, and append results so all timeframe results can be seen at once. Then: *"Normalize this across all timeframes into one comparative grid"* and *"Create a logic tuning checklist derived from the grid."*

---

## Normalization across timeframes

Results were normalized into comparative grids:

* Alignment distribution (W/M/D/S)
* Confidence distribution (L/M/H)
* Bias distribution (N/C/E)
* Constraint blocking percentages
* Signal density metrics

This revealed:

* WEAK / LOW is the dominant baseline across all TFs
* STRONG and HIGH are structurally unreachable under current rules
* CONTINUATION is rare but valid
* EXHAUSTION is rare but reachable
* Each timeframe exhibits a **stable behavioral role**

**From chat:**

* Request: *"Once query is run the results are appended to a page so that I can see all of the timeframe results at once"*; then *"Normalize this across all timeframes into one comparative grid"* and *"Create a logic tuning checklist derived from the grid."*
* Example stats (1W): WEAK 70.86%, MODERATE 20.86%, DISALIGNED 8.28%, STRONG 0%; LOW 100%, HIGH/MEDIUM 0%; NEUTRAL 72.7%, CONTINUATION 27.3%, EXHAUSTION 0%.
* Example stats (23): WEAK 77.6%, DISALIGNED 12.7%, MODERATE 9.7%, STRONG 0%; LOW 100%; NEUTRAL 91.4%, CONTINUATION 8.3%, EXHAUSTION 0.3% (rare but reachable).
* Blocking: STRONG 100% by alignment_score < 0.75; HIGH 100% by multi_tf_stack < 0.7 and < 0.4, and high % by alignment < 0.65; CONTINUATION blocked by wave3_probability and momentum thresholds.

---

## Role classification (emergent outcome)

From diagnostics, each timeframe’s *actual* role became clear:

* 1M: Expressive (early deviation, noisy)
* 1W / 360 / 23: Confirmatory (filtering, validation)
* 1D / 90: Transitional (best balance of structure + movement)

This was **discovered**, not assumed.

**From chat (exact wording):**

* Suggested interpretation text: *"1W is operating as a confirmatory timeframe, not a signal generator."* and *"23 is operating as a confirmatory timeframe, not a signal generator."* (Not advice; framing only.)
* TF hierarchy in implementation: e.g. `['1W', '1D', '360', '90', '23']` (coarsest to finest); optional `'1M'`. Role labels "expressive" and "transitional" are inferred from diagnostics behavior (which TFs show early deviation vs filtering vs balance); the chat explicitly names **confirmatory** for 1W and 23.

---

## Current state of the system

At this point, Engine 2:

* Is internally consistent
* Is conservative by design
* Behaves predictably across timeframes
* Provides reliable market health context

Most importantly:

* It answers *"Is it safe to engage?"*, not *"Should I trade?"*

**From chat:**

* Panel is read-only: only displays the interpretation from the API; all logic in interpretive layer and API, not in UI.
* Engine 2 only SELECTs from `wave_engine_state`; never UPDATE/INSERT/DELETE. Run after deterministic engine (Engine 1); full rebuild or incremental upsert to `wave_alignment_scores`.
* Implemented: migration (wave_alignment_scores, wave_alignment_weights, vw_alignment_engine_input, vw_alignment_scores_latest_per_tf), lib/alignment-engine (types, weights, timeframe-resolver, scores, runner), CLI and API run route, interpretation API and interpretation-engine, AlignmentPanel, diagnostics drawer with predefined queries and normalized grids.

---

## Why this matters

Most trading systems fail because:

* They optimize for signal frequency
* They tune before measuring
* They conflate excitement with information

This process did the opposite:

* Instrument → observe → classify → then tune

Engine 2 is now a **stable foundation**, not a moving target.

**From chat:**

* User chose to add diagnostics and see outcome distributions before changing thresholds: *"I was thinking it would be a good idea of seeing every row and the details appended... This way I could see how often each option for the current code can show."*
* Diagnostics revealed *why* states were blocked (rule-locked unreachable vs rare but reachable), enabling a logic tuning checklist from the grid instead of ad-hoc tuning.

---

## What comes next (when ready)

Only after this stage should you consider:

* Role-specific thresholds
* Explicit signal-capable vs filter-only TFs
* A single non-directional "readiness" score

Those are *evolution steps*, not fixes.

**From chat:**

* Open decisions (from implementation plan): Timeframe hierarchy (include 1M?, "higher TF" = strictly larger period?), weekly bar alignment (Monday 00:00 ET vs Sunday 20:00 ET), divergence window reset (zero_cross only or also engine_reset / wave_phase), population of wave_engine_state by Engine 1.
* Diagnostics produced a *"logic tuning checklist derived from the grid"*; next step is to use that for evolution (e.g. role-specific thresholds, readiness score), not to fix "broken" logic — the system is behaving as designed (conservative, confirmatory).

---

This summary captures the system as it actually exists today — not as an aspiration, but as an engineered artifact. Exact thresholds, API shapes, and diagnostic text are from the chat; role labels (expressive / transitional) are inferred from the same diagnostics where not explicitly stated.
