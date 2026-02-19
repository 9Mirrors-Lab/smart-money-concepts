"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ENGINE2_CHECKLIST_STORAGE_KEY,
  type Engine2ChecklistState,
} from "@/lib/engine2-checklist-types";
import { getConfig } from "@/lib/engine2-logic-config";
import { getActiveOverrides, getVersionStore } from "@/lib/engine2-version-store";
import { Engine2Nav } from "@/components/engine2-nav";
import { LayoutDashboard } from "lucide-react";

function loadState(): Engine2ChecklistState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENGINE2_CHECKLIST_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Engine2ChecklistState;
  } catch {
    return null;
  }
}

const DECISION_LABELS: Record<string, string> = {
  "leave-as-is": "Leave as-is (STRONG intentionally rare)",
  "flag-relaxation": "Flag for controlled relaxation",
  "flag-tf-override": "Flag for TF-specific override",
  "intentionally-conservative": "Confidence intentionally conservative",
  "needs-gradation": "Confidence ladder needs gradation",
  "medium-before-high": "MEDIUM should be reachable before HIGH",
  "matches-intent": "Bias distribution matches intent",
  "continuation-too-rare": "CONTINUATION too rare",
  "exhaustion-unreachable": "EXHAUSTION unreachable (dead-path)",
  "intentional": "Dominant blocker intentional",
  "masks-other-logic": "Dominant blocker masks other logic",
  "needs-sensitivity-testing": "Needs sensitivity testing",
  "roles-align": "Roles align with intent",
  "one-tf-incorrect": "One TF incorrect; TF-specific logic needed",
  "keep-rare": "Keep rare state",
  "remove-dead": "Remove dead state",
  "adjust-thresholds": "Adjust thresholds to revive state",
};

function useVersionInUse() {
  const [versionLabel, setVersionLabel] = useState("Default");
  useEffect(() => {
    const store = getVersionStore();
    const id = store.activeVersionId;
    setVersionLabel(id === null ? "Default" : store.versions.find((v) => v.id === id)?.name ?? id);
  }, []);
  return versionLabel;
}

function useActiveConfig() {
  const [config, setConfig] = useState<ReturnType<typeof getConfig> | null>(null);
  useEffect(() => {
    const sync = () => setConfig(getConfig(getActiveOverrides()));
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);
  return config;
}

export default function Engine2ScorecardPage() {
  const [state, setState] = useState<Engine2ChecklistState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const versionInUse = useVersionInUse();
  const config = useActiveConfig();

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  const refresh = useCallback(() => {
    setState(loadState());
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background p-6 text-muted-foreground">
        Loading scorecard…
      </div>
    );
  }

  const hasChecklistData = state && (
    state.section1Alignment?.decision ||
    state.section2Confidence?.decision ||
    state.section3Bias?.decision ||
    state.section4Gating?.decision ||
    state.section5TimeframeRole?.decision ||
    state.section6RareUnreachable?.decision ||
    (state.finalOutput?.candidateThresholdsToTest?.length ?? 0) > 0 ||
    (state.finalOutput?.deadOrUnreachableStates?.length ?? 0) > 0 ||
    !!state.finalOutput?.confirmedTfRoleMap
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="size-6 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold">Engine 2 diagnostic scorecard</h1>
              <p className="text-sm text-muted-foreground">
                Evaluate whether Engine 2 is behaving as intended; checklist responses feed this view.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground mr-1 text-sm">
              Logic in use: <span className="font-medium text-foreground">{versionInUse}</span>
              {config != null && (
                <span className="ml-1 text-muted-foreground">(thresholds below from active config)</span>
              )}
              {" · "}
              <Link href="/engine2-tune" className="text-primary underline">Tune</Link>
            </span>
            <Button variant="outline" size="sm" onClick={refresh}>
              Refresh from checklist
            </Button>
            <Engine2Nav />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        {!hasChecklistData && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            No checklist data yet. Complete the{" "}
            <Link href="/engine2-checklist" className="underline">
              Engine 2 diagnostic checklist
            </Link>{" "}
            and your responses will appear here.
          </div>
        )}

        {/* Checklist responses summary */}
        {hasChecklistData && state && (
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">Checklist responses</h2>
            <div className="space-y-3 text-sm">
              {state.section1Alignment?.decision && (
                <Row label="1. Alignment coverage" value={DECISION_LABELS[state.section1Alignment.decision] ?? state.section1Alignment.decision} />
              )}
              {state.section2Confidence?.decision && (
                <Row label="2. Confidence saturation" value={DECISION_LABELS[state.section2Confidence.decision] ?? state.section2Confidence.decision} />
              )}
              {state.section3Bias?.decision && (
                <Row label="3. Bias distribution" value={DECISION_LABELS[state.section3Bias.decision] ?? state.section3Bias.decision} />
              )}
              {state.section4Gating?.decision && (
                <Row label="4. Gating dominance" value={DECISION_LABELS[state.section4Gating.decision] ?? state.section4Gating.decision} />
              )}
              {state.section5TimeframeRole?.decision && (
                <Row label="5. Timeframe role" value={DECISION_LABELS[state.section5TimeframeRole.decision] ?? state.section5TimeframeRole.decision} />
              )}
              {state.section6RareUnreachable?.decision && (
                <Row label="6. Rare vs unreachable" value={DECISION_LABELS[state.section6RareUnreachable.decision] ?? state.section6RareUnreachable.decision} />
              )}
              {state.finalOutput?.candidateThresholdsToTest?.length ? (
                <div>
                  <p className="font-medium text-muted-foreground">Candidate thresholds to test</p>
                  <ul className="list-inside list-disc">
                    {state.finalOutput.candidateThresholdsToTest.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {state.finalOutput?.deadOrUnreachableStates?.length ? (
                <div>
                  <p className="font-medium text-muted-foreground">Dead or unreachable states</p>
                  <ul className="list-inside list-disc">
                    {state.finalOutput.deadOrUnreachableStates.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {state.finalOutput?.confirmedTfRoleMap && (
                <Row label="Confirmed TF role map" value={state.finalOutput.confirmedTfRoleMap} />
              )}
              {state.finalOutput?.designIntentNotes && (
                <Row label="Design intent" value={state.finalOutput.designIntentNotes} />
              )}
              {state.finalOutput?.marketBehaviorNotes && (
                <Row label="Market behavior" value={state.finalOutput.marketBehaviorNotes} />
              )}
              {state.finalOutput?.logicArtifactNotes && (
                <Row label="Logic artifacts" value={state.finalOutput.logicArtifactNotes} />
              )}
            </div>
            {state.lastUpdated && (
              <p className="mt-3 text-xs text-muted-foreground">
                Last updated: {new Date(state.lastUpdated).toLocaleString()}
              </p>
            )}
          </section>
        )}

        {/* 1. Coverage scorecard */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold">1. Coverage scorecard</h2>
          <p className="mb-4 text-sm text-muted-foreground">Are the expected states reachable?</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimension</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interpretation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Alignment coverage</TableCell>
                <TableCell>STRONG reachable?</TableCell>
                <TableCell>❌ Unreachable</TableCell>
                <TableCell>STRONG is rule-locked (alignment_score &lt; {config?.alignment_strong ?? 0.75} always)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Confidence coverage</TableCell>
                <TableCell>HIGH reachable?</TableCell>
                <TableCell>❌ Unreachable</TableCell>
                <TableCell>multi_tf_stack_score never ≥ {config?.conf_high_stack ?? 0.7}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Confidence coverage</TableCell>
                <TableCell>MEDIUM reachable?</TableCell>
                <TableCell>❌ Unreachable</TableCell>
                <TableCell>stack &lt; {config?.conf_medium_stack ?? 0.4} blocks all</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Bias coverage</TableCell>
                <TableCell>CONTINUATION reachable?</TableCell>
                <TableCell>✅ Rare</TableCell>
                <TableCell>Valid but gated</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Bias coverage</TableCell>
                <TableCell>EXHAUSTION reachable?</TableCell>
                <TableCell>⚠️ Very rare</TableCell>
                <TableCell>Requires rare divergence + Wave 5</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="mt-3 text-sm">
            <span className="font-medium">Coverage health:</span>{" "}
            <span className="text-amber-600 dark:text-amber-400">🟡 Conservative but consistent</span>
            {" "}No accidental dead paths detected.
          </p>
        </section>

        {/* 2. Dominance scorecard */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold">2. Dominance scorecard</h2>
          <p className="mb-4 text-sm text-muted-foreground">What states dominate in practice?</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimension</TableHead>
                <TableHead>Dominant state</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Classification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Alignment</TableCell>
                <TableCell>WEAK</TableCell>
                <TableCell>65–78%</TableCell>
                <TableCell>Expected baseline</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Confidence</TableCell>
                <TableCell>LOW</TableCell>
                <TableCell>~100%</TableCell>
                <TableCell>Overrepresented</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Bias</TableCell>
                <TableCell>NEUTRAL</TableCell>
                <TableCell>72–91%</TableCell>
                <TableCell>Default</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="mt-3 text-sm">
            <span className="font-medium">Dominance health:</span>{" "}
            <span className="text-emerald-600 dark:text-emerald-400">🟢 Stable baseline established</span>
            {" "}Engine 2 is acting as a filter, not a trigger.
          </p>
        </section>

        {/* 3. Gating pressure scorecard */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold">3. Gating pressure scorecard</h2>
          <p className="mb-4 text-sm text-muted-foreground">What rules exert the most force?</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gate</TableHead>
                <TableHead>Blocking %</TableHead>
                <TableHead>Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>alignment_score &lt; {config?.alignment_strong ?? 0.75}</TableCell>
                <TableCell>~100%</TableCell>
                <TableCell className="text-red-500">🔴 Hard lock</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>multi_tf_stack_score &lt; {config?.conf_high_stack ?? 0.7}</TableCell>
                <TableCell>~100%</TableCell>
                <TableCell className="text-red-500">🔴 Hard lock</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>multi_tf_stack_score &lt; {config?.conf_medium_stack ?? 0.4}</TableCell>
                <TableCell>~100%</TableCell>
                <TableCell className="text-red-500">🔴 Hard lock</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>wave3_probability &lt; {config?.bias_cont_wave3 ?? 0.6}</TableCell>
                <TableCell>18–40%</TableCell>
                <TableCell className="text-amber-500">🟠 Soft gate</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>momentum_strength_score &lt; {config?.bias_cont_momentum ?? 0.55}</TableCell>
                <TableCell>14–27%</TableCell>
                <TableCell className="text-amber-500">🟠 Soft gate</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="mt-3 text-sm">
            <span className="font-medium">Gating health:</span>{" "}
            <span className="text-amber-600 dark:text-amber-400">🟡 Intentional but aggressive</span>
            {" "}Hard locks dominate; soft gates function normally.
          </p>
        </section>

        {/* 4. Role integrity scorecard */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold">4. Role integrity scorecard</h2>
          <p className="mb-4 text-sm text-muted-foreground">Is each timeframe behaving as intended?</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TF</TableHead>
                <TableHead>Intended role</TableHead>
                <TableHead>Observed behavior</TableHead>
                <TableHead>Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["1M", "Expressive", "Noisy, deviation-heavy", "✅"],
                ["1W", "Confirmatory", "Rarely leaves baseline", "✅"],
                ["1D", "Transitional", "Occasional CONT", "✅"],
                ["360", "Confirmatory", "Structural filter", "✅"],
                ["90", "Transitional", "Execution-adjacent", "✅"],
                ["23", "Micro-confirm", "Rare signals", "✅"],
              ].map(([tf, role, behavior, match]) => (
                <TableRow key={tf}>
                  <TableCell>{tf}</TableCell>
                  <TableCell>{role}</TableCell>
                  <TableCell>{behavior}</TableCell>
                  <TableCell>{match}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-sm">
            <span className="font-medium">Role health:</span>{" "}
            <span className="text-emerald-600 dark:text-emerald-400">🟢 Excellent</span>
            {" "}No timeframe acting outside design intent.
          </p>
        </section>

        {/* 5. Signal density scorecard */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold">5. Signal density scorecard</h2>
          <p className="mb-4 text-sm text-muted-foreground">Is the system producing meaningful non-baseline events?</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TF</TableHead>
                <TableHead>CONT events</TableHead>
                <TableHead>EXH events</TableHead>
                <TableHead>Density</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["1M", "Low", "Very low", "Low"],
                ["1W", "Medium", "0", "Medium"],
                ["1D", "Medium", "0", "Medium"],
                ["360", "Medium", "0", "Medium"],
                ["90", "Medium", "Few", "Medium"],
                ["23", "Medium", "Few", "Medium"],
              ].map(([tf, cont, exh, density]) => (
                <TableRow key={tf}>
                  <TableCell>{tf}</TableCell>
                  <TableCell>{cont}</TableCell>
                  <TableCell>{exh}</TableCell>
                  <TableCell>{density}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-sm">
            <span className="font-medium">Signal density health:</span>{" "}
            <span className="text-emerald-600 dark:text-emerald-400">🟢 Appropriate for a safety layer</span>
            {" "}No TF is spamming signals.
          </p>
        </section>

        {/* 6. Diagnostic outcome score */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold">6. Diagnostic outcome score</h2>
          <p className="mb-4 text-sm text-muted-foreground">Summary</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Internal consistency</TableCell>
                <TableCell className="text-emerald-600 dark:text-emerald-400">🟢 Strong</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Logical reachability</TableCell>
                <TableCell className="text-amber-600 dark:text-amber-400">🟡 Conservative</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Role adherence</TableCell>
                <TableCell className="text-emerald-600 dark:text-emerald-400">🟢 Strong</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Overconstraint risk</TableCell>
                <TableCell className="text-amber-600 dark:text-amber-400">🟡 Moderate</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Signal abuse risk</TableCell>
                <TableCell className="text-emerald-600 dark:text-emerald-400">🟢 Low</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        <div className="pb-8">
          <Link href="/engine2-checklist">
            <Button variant="outline">Back to checklist</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-muted-foreground">{label}: </span>
      <span>{value}</span>
    </div>
  );
}
