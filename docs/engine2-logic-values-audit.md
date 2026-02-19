# Engine 2 logic values audit

Audit of every place Engine 2 threshold/logic values (e.g. `alignment_strong`, `0.75`, `conf_high_stack`) are used: what has been updated to use the active version (config/overrides) and what remains hardcoded or outstanding.

---

## 1. Single source of truth

- **`lib/engine2-logic-config.ts`**
  - Defines `Engine2LogicConfig`, `Engine2LogicOverrides`, `DEFAULT_ENGINE2_LOGIC`, `ENGINE2_LOGIC_ENTRIES`, `getConfig(overrides)`.
  - All numeric defaults live here. No hardcoded logic values elsewhere should duplicate these for runtime behavior.

---

## 2. Already updated (use config / overrides)

### 2.1 Interpretation and breakdown

| Location | What was done |
|----------|----------------|
| `lib/interpretation-engine.ts` | `interpret()` and `getBarBreakdown()` take optional `overrides`; all thresholds (alignment, confidence, bias, key factors, warnings, stack_aligned) use `getConfig(overrides)`. Rules-fired/blocked strings use config values. |
| `app/api/alignment-engine/interpretation/route.ts` | Parses `overrides` from query; passes to `interpret()` and `getBarBreakdown()` for both single-bar and multiTf responses. |

### 2.2 Diagnostics API

| Location | What was done |
|----------|----------------|
| `app/api/alignment-engine/diagnostics/route.ts` | Parses `overrides`, uses `interpret(combined, overrides)` per row, then `runDiagnostics(rows, getConfig(overrides))`. Gating labels (STR/HIGH/CONT) and stack band boundaries use config (e.g. `alignment_score < ${c.alignment_strong}`). |

### 2.3 Clients that send overrides

| Location | What was done |
|----------|----------------|
| `app/smc-viewer/page.tsx` | Single-bar and multiTf interpretation fetches append `getActiveOverridesQueryFragment()`. Refetches when `engine2VersionKey` changes (and on focus). |
| `components/diagnostics-panel.tsx` | Interpretation (with breakdown) and diagnostics fetches append `getActiveOverridesQueryFragment()`. |
| `components/aggregate-diagnostics-panel.tsx` | Diagnostics fetch per TF includes `getActiveOverridesQueryFragment()`. `getStackLowPct()` and `getGatingPcts()` work with dynamic band/blocker labels from API. |

### 2.4 Tune and version store

| Location | What was done |
|----------|----------------|
| `lib/engine2-version-store.ts` | Stores versions (full config snapshots), active version id, `getActiveOverrides()`, `getActiveOverridesQueryFragment()`. |
| `app/engine2-tune/page.tsx` | Shows active logic (all keys from `getConfig(getActiveOverrides())`), version list, logic gates table, Apply to create new version. |

### 2.5 Diagnostic flow page

| Location | What was done |
|----------|----------------|
| `app/engine2-diagnostic-flow/page.tsx` | "Version in use" and "Active thresholds" from version store + `getConfig(getActiveOverrides())`. Rules text for Steps 1–3 built from `rulesFromConfig(activeConfig)` so they show current version numbers. Load fetches diagnostics API with overrides and fills tables; Clear resets to static example. Syncs version on focus. |

---

## 3. Outstanding / still hardcoded (by file)

### 3.1 `lib/engine2-logic-inventory.ts`

| Line / area | Current | Recommendation |
|-------------|---------|----------------|
| `ENGINE2_DECISION_FLOW` ladder strings | Hardcoded `0.75`, `0.55`, `0.35`, `0.70`, `0.65`, `0.40`, `0.6`, `0.55`, `0.5` in condition text | **Optional:** Either keep as “default reference” only and add a note that Diagnostic flow shows live rules from config, or accept optional config and render ladder from it (would require this module to depend on config or receive config from caller). |

This file is the **logic inventory** reference. The **diagnostic flow** page now builds rules from config; the inventory is still the canonical “what the steps are” but with default numbers. Low priority unless you want the inventory page itself to show “current version” rules.

### 3.2 `lib/engine2-diagnostic-flow-data.ts`

| Line / area | Current | Recommendation |
|-------------|---------|----------------|
| `PER_TF_DIAGNOSTIC` (all TFs) | Static seed data: blocker labels like `"alignment_score < 0.75"`, `"stack < 0.70"`, `"stack < 0.40"`, `"alignment < 0.65"`, `"wave3_probability < 0.6"`, `"momentum_strength_score < 0.55"` | **By design:** Used only when no data is loaded. After **Load** on Diagnostic flow, tables use API data (with current version). No change required unless you want the static fallback to be config-aware (e.g. never show numbers, or generate from default config). |

### 3.3 `components/aggregate-diagnostics-panel.tsx`

| Line / area | Current | Recommendation |
|-------------|---------|----------------|
| Table header `title` attributes (~466–469) | `title="alignment_score < 0.75"`, `title="stack < 0.7"`, `title="stack < 0.4"`, `title="wave3 < 0.6"` | **Outstanding:** These are tooltips for the STR / HIGH / MED / CONT columns. They always show default numbers. **Fix:** Pass active config into the panel (or read from version store in the component) and set titles to e.g. `alignment_score < ${config.alignment_strong}`. |

### 3.4 `app/engine2-scorecard/page.tsx`

| Line / area | Current | Recommendation |
|-------------|---------|----------------|
| Coverage table (e.g. ~217, 223, 229) | Fixed copy: "STRONG is rule-locked (alignment_score &lt; 0.75 always)", "multi_tf_stack_score never ≥ 0.7", "stack &lt; 0.4 blocks all" | **Outstanding:** Scorecard is a **template** summarizing checklist conclusions; numbers are illustrative. **Options:** (A) Add a note “Thresholds shown are defaults; active version in Tune may differ.” (B) Read active config and substitute in these strings so the scorecard reflects the version in use. |
| Gating pressure table (~307, 312, 317, 322, 327) | Fixed copy: "alignment_score &lt; 0.75", "multi_tf_stack_score &lt; 0.7", "&lt; 0.4", "wave3_probability &lt; 0.6", "momentum_strength_score &lt; 0.55" | Same as above: either document as default or make dynamic from config. |

### 3.5 `app/engine2-checklist/page.tsx`

| Line / area | Current | Recommendation |
|-------------|---------|----------------|
| Tuning levers (e.g. ~235–237, 286, 340) | Example levers like "alignment_score ≥ 0.75 (primary STRONG gate)", "allow STRONG when: alignment_score ≥ 0.70 and momentum_strength ≥ 0.6", "stack ≥ 0.35 and alignment ≥ 0.55", "wave5_probability ≥ 0.55 and divergence risk ≥ 0.5" | **By design:** These are **candidate** tuning ideas (DO NOT APPLY YET). They are not the running logic. **Optional:** Add one line at the top of the levers block: “Current active thresholds are in Tune; these are example levers only.” Or leave as-is. |

### 3.6 `lib/engine2-checklist-seed-kcex-ethusdt.ts`

| Line / area | Current | Recommendation |
|-------------|---------|----------------|
| Comments and `logicArtifactNotes` / `candidateThresholdsToTest` | References to 0.75, 0.7, 0.4, 0.6, etc. | **By design:** Seed data and notes for one specific diagnostic run (KCEX_ETHUSDT.P). Represents a snapshot in time. No change required for version consistency. |

### 3.7 `lib/frame-to-plotly.ts`

| Line / area | Current | Recommendation |
|-------------|---------|----------------|
| Various numeric literals | e.g. `0.55`, `0.4`, `0.6`, `0.75` in colors, opacity, FIB ratios | **Not logic:** These are chart styling (opacity, colors, Fibonacci ratios). No change. |

---

## 4. Not applicable (no logic values)

- **`components/alignment-panel.tsx`**  
  Uses `interpretation.stack_aligned` (boolean from engine); no thresholds. No change.

- **`app/engine2-logic-inventory/page.tsx`**  
  Displays `ENGINE2_DECISION_FLOW` and related reference; does not call the engine. Only affected if `engine2-logic-inventory.ts` is made config-aware (see 3.1).

---

## 5. Summary table

| Area | Status | Action |
|------|--------|--------|
| interpretation-engine | ✅ Uses config | None |
| interpretation API | ✅ Uses overrides | None |
| diagnostics API | ✅ Uses overrides + config for labels/bands | None |
| smc-viewer (chart + multiTf) | ✅ Sends overrides, refetch on version | None |
| diagnostics-panel | ✅ Sends overrides | None |
| aggregate-diagnostics-panel | ✅ Sends overrides; getStackLowPct/getGatingPcts dynamic | **Optional:** Column header tooltips (STR/HIGH/MED/CONT) still 0.75, 0.7, 0.4, 0.6 |
| engine2-tune | ✅ Full config UI | None |
| engine2-diagnostic-flow | ✅ Rules from config, Load uses overrides | None |
| engine2-logic-inventory (lib) | ⚠️ Hardcoded ladder | Optional: document as default or make config-aware |
| engine2-diagnostic-flow-data | ⚠️ Static seed labels | By design; only when not loaded |
| engine2-scorecard | ⚠️ Hardcoded threshold copy | Optional: note or dynamic from config |
| engine2-checklist | ⚠️ Example lever text | Optional: clarify “example only” |
| engine2-checklist-seed | ⚠️ Snapshot notes | No change |

---

## 6. Recommended next steps (if desired)

1. **Aggregate diagnostics panel:** Read active config (e.g. from version store) and set table header `title` attributes to `alignment_score < ${config.alignment_strong}` etc., so tooltips match the version in use.
2. **Scorecard:** Either add a short note that displayed thresholds are defaults, or pass active config into the scorecard and substitute threshold values in the coverage/gating tables.
3. **Logic inventory:** Add a sentence that “Numbers below are defaults; the Diagnostic flow page shows rules for the version currently in use in Tune.”

No other code paths use logic values for **runtime** behavior without going through config/overrides; the remaining items are copy, tooltips, or reference text.
