"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENGINE2_CHECKLIST_STORAGE_KEY,
  defaultChecklistState,
  type Engine2ChecklistState,
  type AlignmentCoverageResponses,
  type ConfidenceSaturationResponses,
  type BiasDistributionResponses,
  type GatingDominanceResponses,
  type TimeframeRoleResponses,
  type RareVsUnreachableResponses,
  type ReadinessResponses,
} from "@/lib/engine2-checklist-types";
import { engine2ChecklistSeedKcexEthusdt } from "@/lib/engine2-checklist-seed-kcex-ethusdt";
import { getVersionStore } from "@/lib/engine2-version-store";
import { Engine2Nav } from "@/components/engine2-nav";
import { ClipboardList, ExternalLink, FileDown } from "lucide-react";

function loadState(): Engine2ChecklistState {
  if (typeof window === "undefined") return defaultChecklistState;
  try {
    const raw = localStorage.getItem(ENGINE2_CHECKLIST_STORAGE_KEY);
    if (!raw) return defaultChecklistState;
    const parsed = JSON.parse(raw) as Engine2ChecklistState;
    return { ...defaultChecklistState, ...parsed };
  } catch {
    return defaultChecklistState;
  }
}

function saveState(state: Engine2ChecklistState) {
  if (typeof window === "undefined") return;
  const toSave = { ...state, lastUpdated: new Date().toISOString() };
  localStorage.setItem(ENGINE2_CHECKLIST_STORAGE_KEY, JSON.stringify(toSave));
}

function useVersionInUse() {
  const [versionLabel, setVersionLabel] = useState("Default");
  useEffect(() => {
    const store = getVersionStore();
    const id = store.activeVersionId;
    setVersionLabel(id === null ? "Default" : store.versions.find((v) => v.id === id)?.name ?? id);
  }, []);
  return versionLabel;
}

export default function Engine2ChecklistPage() {
  const [state, setState] = useState<Engine2ChecklistState>(defaultChecklistState);
  const [hydrated, setHydrated] = useState(false);
  const versionInUse = useVersionInUse();

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<Engine2ChecklistState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  const setMarkdown = useCallback(
    (value: string) => update({ diagnosticMarkdown: value }),
    [update]
  );

  const setSection1 = useCallback(
    (patch: Partial<AlignmentCoverageResponses>) =>
      update({ section1Alignment: { ...state.section1Alignment, ...patch } }),
    [update, state.section1Alignment]
  );
  const setSection2 = useCallback(
    (patch: Partial<ConfidenceSaturationResponses>) =>
      update({ section2Confidence: { ...state.section2Confidence, ...patch } }),
    [update, state.section2Confidence]
  );
  const setSection3 = useCallback(
    (patch: Partial<BiasDistributionResponses>) =>
      update({ section3Bias: { ...state.section3Bias, ...patch } }),
    [update, state.section3Bias]
  );
  const setSection4 = useCallback(
    (patch: Partial<GatingDominanceResponses>) =>
      update({ section4Gating: { ...state.section4Gating, ...patch } }),
    [update, state.section4Gating]
  );
  const setSection5 = useCallback(
    (patch: Partial<TimeframeRoleResponses>) =>
      update({ section5TimeframeRole: { ...state.section5TimeframeRole, ...patch } }),
    [update, state.section5TimeframeRole]
  );
  const setSection6 = useCallback(
    (patch: Partial<RareVsUnreachableResponses>) =>
      update({ section6RareUnreachable: { ...state.section6RareUnreachable, ...patch } }),
    [update, state.section6RareUnreachable]
  );
  const setSection7 = useCallback(
    (patch: Partial<ReadinessResponses>) =>
      update({ section7Readiness: { ...state.section7Readiness, ...patch } }),
    [update, state.section7Readiness]
  );
  const setFinalOutput = useCallback(
    (patch: Partial<Engine2ChecklistState["finalOutput"]>) =>
      update({ finalOutput: { ...state.finalOutput, ...patch } }),
    [update, state.finalOutput]
  );

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background p-6 text-muted-foreground">
        Loading checklist…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="size-6 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold">Engine 2 diagnostic checklist</h1>
              <p className="text-sm text-muted-foreground">
                Use after Engine 2 diagnostic. Answer using grid values; only consider tuning when a
                pattern repeats across multiple timeframes.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground mr-1 text-sm">
              Logic in use: <span className="font-medium text-foreground">{versionInUse}</span>
              {" · "}
              <Link href="/engine2-tune" className="text-primary underline">Tune</Link>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const seed = {
                  ...engine2ChecklistSeedKcexEthusdt,
                  lastUpdated: new Date().toISOString(),
                };
                setState(seed);
                saveState(seed);
              }}
            >
              <FileDown className="mr-2 size-4" />
              Load first analysis (KCEX_ETHUSDT.P)
            </Button>
            <Engine2Nav />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        {/* Diagnostic markdown input */}
        <section className="space-y-2">
          <Label className="text-base font-medium">Engine 2 diagnostic markdown</Label>
          <p className="text-sm text-muted-foreground">
            Paste the markdown output from the Engine 2 diagnostic run (grid values, distributions,
            gating analysis).
          </p>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Paste diagnostic markdown here…"
            value={state.diagnosticMarkdown}
            onChange={(e) => setMarkdown(e.target.value)}
          />
        </section>

        {/* Section 1: Alignment State Coverage */}
        <SectionCard title="1. Alignment state coverage check" goal="Ensure STRONG / MODERATE / WEAK / DISALIGNED states are reachable and meaningful.">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Questions</p>
              <div className="flex flex-col gap-3">
                <CheckItem
                  label="Does STRONG alignment appear at least 5–10% on any timeframe?"
                  checked={state.section1Alignment.strongAppears5To10}
                  onCheckedChange={(v) => setSection1({ strongAppears5To10: !!v })}
                />
                <CheckItem
                  label="Is STRONG 0% across all timeframes?"
                  checked={state.section1Alignment.strongZeroEverywhere}
                  onCheckedChange={(v) => setSection1({ strongZeroEverywhere: !!v })}
                />
                <CheckItem
                  label="Is WEAK >60% on 4+ timeframes?"
                  checked={state.section1Alignment.weakOver60FourTfs}
                  onCheckedChange={(v) => setSection1({ weakOver60FourTfs: !!v })}
                />
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Is DISALIGNED clustering only on higher TFs (expected) or everywhere (problem)?</Label>
                  <Select
                    value={state.section1Alignment.disalignedClustering ?? ""}
                    onValueChange={(v) => setSection1({ disalignedClustering: v as AlignmentCoverageResponses["disalignedClustering"] })}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="higher-tfs-only">Higher TFs only (expected)</SelectItem>
                      <SelectItem value="everywhere">Everywhere (problem)</SelectItem>
                      <SelectItem value="unsure">Unsure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <InterpretationBlock
              items={[
                "STRONG = 0% everywhere → Rule-lock detected",
                "WEAK dominant everywhere → Baseline too strict or stack overweighted",
              ]}
            />
            <TuningLeversBlock
              items={[
                "alignment_score ≥ 0.75 (primary STRONG gate)",
                "relative weighting of alignment_score vs stack_score",
                "allow STRONG when: alignment_score ≥ 0.70 and momentum_strength ≥ 0.6",
              ]}
            />
            <DecisionSelect
              label="Decision"
              value={state.section1Alignment.decision ?? ""}
              onValueChange={(v) => setSection1({ decision: v as AlignmentCoverageResponses["decision"] })}
              options={[
                { value: "leave-as-is", label: "Leave as-is (STRONG is intentionally rare)" },
                { value: "flag-relaxation", label: "Flag for controlled relaxation (simulation required)" },
                { value: "flag-tf-override", label: "Flag for TF-specific override (never global first)" },
              ]}
            />
          </div>
        </SectionCard>

        {/* Section 2: Confidence State Saturation */}
        <SectionCard title="2. Confidence state saturation check" goal="Avoid LOW confidence being a permanent default.">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Questions</p>
              <div className="flex flex-col gap-3">
                <CheckItem
                  label="Is LOW confidence ≥90% on all timeframes?"
                  checked={state.section2Confidence.lowConfidenceOver90All}
                  onCheckedChange={(v) => setSection2({ lowConfidenceOver90All: !!v })}
                />
                <CheckItem
                  label="Are MEDIUM and HIGH both 0%?"
                  checked={state.section2Confidence.mediumHighBothZero}
                  onCheckedChange={(v) => setSection2({ mediumHighBothZero: !!v })}
                />
                <CheckItem
                  label="Are confidence gates blocked by the same rule everywhere?"
                  checked={state.section2Confidence.sameRuleBlocksEverywhere}
                  onCheckedChange={(v) => setSection2({ sameRuleBlocksEverywhere: !!v })}
                />
              </div>
            </div>
            <InterpretationBlock
              items={[
                "Confidence system is binary, not graduated",
                "MEDIUM/HIGH are unreachable states, not rare ones",
              ]}
            />
            <TuningLeversBlock
              items={[
                "Split confidence bands by timeframe class: HTF stricter, LTF looser",
                "Introduce relative confidence (ranked within TF)",
                "Allow MEDIUM when: stack ≥ 0.35 and alignment ≥ 0.55",
              ]}
            />
            <DecisionSelect
              label="Decision"
              value={state.section2Confidence.decision ?? ""}
              onValueChange={(v) => setSection2({ decision: v as ConfidenceSaturationResponses["decision"] })}
              options={[
                { value: "intentionally-conservative", label: "Confidence is intentionally conservative (confirmatory system)" },
                { value: "needs-gradation", label: "Confidence ladder needs gradation" },
                { value: "medium-before-high", label: "MEDIUM should be reachable before HIGH" },
              ]}
            />
          </div>
        </SectionCard>

        {/* Section 3: Dominant Bias Distribution */}
        <SectionCard title="3. Dominant bias distribution check" goal="Ensure CONTINUATION / EXHAUSTION represent phases, not anomalies.">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Questions</p>
              <div className="flex flex-col gap-3">
                <CheckItem
                  label="Is NEUTRAL >70% on most timeframes?"
                  checked={state.section3Bias.neutralOver70Most}
                  onCheckedChange={(v) => setSection3({ neutralOver70Most: !!v })}
                />
                <CheckItem
                  label="Does CONTINUATION cluster around specific TFs (e.g. 1D, 90)?"
                  checked={state.section3Bias.continuationClustersTfs}
                  onCheckedChange={(v) => setSection3({ continuationClustersTfs: !!v })}
                />
                <CheckItem
                  label="Is EXHAUSTION <1% but non-zero (good)?"
                  checked={state.section3Bias.exhaustionLess1NonZero}
                  onCheckedChange={(v) => setSection3({ exhaustionLess1NonZero: !!v })}
                />
                <CheckItem
                  label="Is EXHAUSTION always 0 (locked)?"
                  checked={state.section3Bias.exhaustionAlwaysZero}
                  onCheckedChange={(v) => setSection3({ exhaustionAlwaysZero: !!v })}
                />
              </div>
            </div>
            <InterpretationBlock
              items={[
                "NEUTRAL dominance is expected",
                "CONTINUATION rarity is acceptable only if localized",
                "EXHAUSTION = 0 everywhere → logic never completes",
              ]}
            />
            <TuningLeversBlock
              items={[
                "Separate phase detection from risk detection",
                "Allow EXHAUSTION when: wave5_probability ≥ 0.55 and divergence risk ≥ 0.5",
                "Decouple EXHAUSTION from volatility requirement (optional)",
              ]}
            />
            <DecisionSelect
              label="Decision"
              value={state.section3Bias.decision ?? ""}
              onValueChange={(v) => setSection3({ decision: v as BiasDistributionResponses["decision"] })}
              options={[
                { value: "matches-intent", label: "Bias distribution matches intent" },
                { value: "continuation-too-rare", label: "CONTINUATION too rare → review wave3_probability gate" },
                { value: "exhaustion-unreachable", label: "EXHAUSTION unreachable → logic dead-path" },
              ]}
            />
          </div>
        </SectionCard>

        {/* Section 4: Gating Dominance */}
        <SectionCard title="4. Gating dominance check (critical)" goal="Identify rules that dominate outcomes globally.">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Questions</p>
              <div className="flex flex-col gap-3">
                <CheckItem
                  label="Does one rule block ≥95% across all TFs?"
                  checked={state.section4Gating.oneRuleBlocks95All}
                  onCheckedChange={(v) => setSection4({ oneRuleBlocks95All: !!v })}
                />
                <CheckItem
                  label="Is the same blocker present on HTF and LTF?"
                  checked={state.section4Gating.sameBlockerHtfLtf}
                  onCheckedChange={(v) => setSection4({ sameBlockerHtfLtf: !!v })}
                />
                <CheckItem
                  label="Are multiple rules redundant (blocking same outcome)?"
                  checked={state.section4Gating.multipleRulesRedundant}
                  onCheckedChange={(v) => setSection4({ multipleRulesRedundant: !!v })}
                />
              </div>
            </div>
            <InterpretationBlock items={["This is structural dominance, not market behavior."]} />
            <TuningLeversBlock
              items={[
                "Rank blockers by impact",
                "Identify first unlock candidate",
                "Test removing one blocker at a time in diagnostics",
              ]}
            />
            <DecisionSelect
              label="Decision"
              value={state.section4Gating.decision ?? ""}
              onValueChange={(v) => setSection4({ decision: v as GatingDominanceResponses["decision"] })}
              options={[
                { value: "intentional", label: "Dominant blocker is intentional (design choice)" },
                { value: "masks-other-logic", label: "Dominant blocker masks other logic" },
                { value: "needs-sensitivity-testing", label: "Needs sensitivity testing (next phase)" },
              ]}
            />
          </div>
        </SectionCard>

        {/* Section 5: Timeframe Role Validation */}
        <SectionCard title="5. Timeframe role validation" goal="Ensure each TF behaves according to its intended role.">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Questions</p>
              <div className="flex flex-col gap-3">
                <CheckItem
                  label="Do HTFs behave confirmatory (LOW confidence, NEUTRAL bias)?"
                  checked={state.section5TimeframeRole.htfsConfirmatory}
                  onCheckedChange={(v) => setSection5({ htfsConfirmatory: !!v })}
                />
                <CheckItem
                  label="Do mid-TFs show most CONTINUATION?"
                  checked={state.section5TimeframeRole.midTfsShowContinuation}
                  onCheckedChange={(v) => setSection5({ midTfsShowContinuation: !!v })}
                />
                <CheckItem
                  label="Do LTFs show more variance but less confidence?"
                  checked={state.section5TimeframeRole.ltfsVarianceLessConfidence}
                  onCheckedChange={(v) => setSection5({ ltfsVarianceLessConfidence: !!v })}
                />
              </div>
            </div>
            <DecisionSelect
              label="Decision"
              value={state.section5TimeframeRole.decision ?? ""}
              onValueChange={(v) => setSection5({ decision: v as TimeframeRoleResponses["decision"] })}
              options={[
                { value: "roles-align", label: "Roles align with intent" },
                { value: "one-tf-incorrect", label: "One TF behaving incorrectly → TF-specific logic needed" },
              ]}
            />
          </div>
        </SectionCard>

        {/* Section 6: Rare vs Unreachable */}
        <SectionCard title="6. Rare vs unreachable state audit" goal="Separate “rare but valid” from “dead code”.">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Questions</p>
              <div className="flex flex-col gap-3">
                <CheckItem
                  label="Does the state ever appear (>0)?"
                  checked={state.section6RareUnreachable.stateEverAppears}
                  onCheckedChange={(v) => setSection6({ stateEverAppears: !!v })}
                />
                <CheckItem
                  label="If yes, is it <1–5% (rare)?"
                  checked={state.section6RareUnreachable.stateRareUnder5}
                  onCheckedChange={(v) => setSection6({ stateRareUnder5: !!v })}
                />
                <div className="flex items-center gap-2">
                  <Label className="text-sm">If no, is it blocked by design or accident?</Label>
                  <Select
                    value={state.section6RareUnreachable.stateBlockedDesignOrAccident ?? ""}
                    onValueChange={(v) => setSection6({ stateBlockedDesignOrAccident: (v || null) as RareVsUnreachableResponses["stateBlockedDesignOrAccident"] })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="accident">Accident</SelectItem>
                      <SelectItem value="unsure">Unsure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <InterpretationBlock
              items={[
                "Rare: appears <5% → good",
                "Unreachable: appears 0% → inspect",
                "Overrepresented: >70% → dominant baseline",
              ]}
            />
            <DecisionSelect
              label="Decision"
              value={state.section6RareUnreachable.decision ?? ""}
              onValueChange={(v) => setSection6({ decision: v as RareVsUnreachableResponses["decision"] })}
              options={[
                { value: "keep-rare", label: "Keep rare state" },
                { value: "remove-dead", label: "Remove dead state" },
                { value: "adjust-thresholds", label: "Adjust thresholds to revive state" },
              ]}
            />
          </div>
        </SectionCard>

        {/* Section 7: Readiness Before Tuning */}
        <SectionCard title="7. Readiness check before tuning" goal="Do NOT tune until all are true.">
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <CheckItem
                label="Grid populated for all TFs"
                checked={state.section7Readiness.gridPopulatedAllTfs}
                onCheckedChange={(v) => setSection7({ gridPopulatedAllTfs: !!v })}
              />
              <CheckItem
                label="≥500 bars per TF (or noted)"
                checked={state.section7Readiness.fiveHundredBarsPerTf}
                onCheckedChange={(v) => setSection7({ fiveHundredBarsPerTf: !!v })}
              />
              <CheckItem
                label="Dominant blockers identified"
                checked={state.section7Readiness.dominantBlockersIdentified}
                onCheckedChange={(v) => setSection7({ dominantBlockersIdentified: !!v })}
              />
              <CheckItem
                label="Desired role per TF documented"
                checked={state.section7Readiness.desiredRolePerTfDocumented}
                onCheckedChange={(v) => setSection7({ desiredRolePerTfDocumented: !!v })}
              />
            </div>
          </div>
        </SectionCard>

        {/* Final output */}
        <SectionCard title="Final output of this checklist" goal="Candidate thresholds, dead/unreachable states, TF role map, and separation of design intent vs market behavior vs logic artifacts.">
          <div className="space-y-4">
            <TextAreaRow
              label="Candidate thresholds to test"
              value={state.finalOutput.candidateThresholdsToTest?.join("\n") ?? ""}
              onChange={(v) => setFinalOutput({ candidateThresholdsToTest: v ? v.split("\n").filter(Boolean) : [] })}
              placeholder="One per line"
            />
            <TextAreaRow
              label="Dead or unreachable states"
              value={state.finalOutput.deadOrUnreachableStates?.join("\n") ?? ""}
              onChange={(v) => setFinalOutput({ deadOrUnreachableStates: v ? v.split("\n").filter(Boolean) : [] })}
              placeholder="One per line"
            />
            <TextAreaRow
              label="Confirmed TF role map"
              value={state.finalOutput.confirmedTfRoleMap ?? ""}
              onChange={(v) => setFinalOutput({ confirmedTfRoleMap: v })}
              placeholder="e.g. 1M expressive, 1W confirmatory…"
            />
            <TextAreaRow
              label="Design intent"
              value={state.finalOutput.designIntentNotes ?? ""}
              onChange={(v) => setFinalOutput({ designIntentNotes: v })}
            />
            <TextAreaRow
              label="Market behavior"
              value={state.finalOutput.marketBehaviorNotes ?? ""}
              onChange={(v) => setFinalOutput({ marketBehaviorNotes: v })}
            />
            <TextAreaRow
              label="Logic artifacts"
              value={state.finalOutput.logicArtifactNotes ?? ""}
              onChange={(v) => setFinalOutput({ logicArtifactNotes: v })}
            />
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2 pb-8">
          <Link href="/engine2-scorecard">
            <Button>View diagnostic scorecard</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

function SectionCard({
  title,
  goal,
  children,
}: {
  title: string;
  goal: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{goal}</p>
      {children}
    </section>
  );
}

function CheckItem({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked?: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={label.slice(0, 40).replace(/\W/g, "-")}
        checked={checked ?? false}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      <Label htmlFor={label.slice(0, 40).replace(/\W/g, "-")} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}

function InterpretationBlock({ items }: { items: string[] }) {
  return (
    <div className="rounded border border-border/80 bg-muted/30 px-3 py-2">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Interpretation</p>
      <ul className="list-inside list-disc text-sm">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function TuningLeversBlock({ items }: { items: string[] }) {
  return (
    <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Tuning levers (do not apply yet; candidates only)
      </p>
      <p className="mb-2 text-xs text-amber-700/90 dark:text-amber-400/90">
        Current active thresholds are in Tune; these are example levers only.
      </p>
      <ul className="list-inside list-disc text-sm">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function DecisionSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger className="w-[320px]">
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextAreaRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <textarea
        className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
