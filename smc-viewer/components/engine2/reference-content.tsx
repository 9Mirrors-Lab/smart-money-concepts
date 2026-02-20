"use client";

import Link from "next/link";
import {
  ENGINE2_DECISION_FLOW,
  ALIGNMENT_SCORE_PREREQUISITE,
  AFTER_LADDER,
  WAVE_NUMBER_VALUES,
} from "@/lib/engine2-logic-inventory";

export function Engine2ReferenceContent() {
  return (
    <main className="w-full max-w-5xl space-y-8 px-4 py-6">
      {/* Flow order intro */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-2 text-base font-semibold">Engine 2 decision flow (order of evaluation)</h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Compute alignment_score</li>
          <li>Classify STRONG / MODERATE / WEAK / DISALIGNED</li>
          <li>Evaluate stack</li>
          <li>Evaluate alignment for HIGH confidence</li>
          <li>Assign confidence (HIGH / MEDIUM / LOW)</li>
          <li>Evaluate wave + momentum for bias</li>
          <li>Evaluate divergence for warnings</li>
        </ol>
      </section>

      {/* Prerequisite: alignment_score */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-2 text-base font-semibold">{ALIGNMENT_SCORE_PREREQUISITE.title}</h2>
        <pre className="mb-3 overflow-x-auto whitespace-pre rounded-md border border-border bg-muted/50 px-4 py-3 font-mono text-sm">
          {ALIGNMENT_SCORE_PREREQUISITE.formula}
        </pre>
        <p className="mb-2 text-sm text-muted-foreground">Weights (wave_alignment_weights):</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-mono">
          {ALIGNMENT_SCORE_PREREQUISITE.weights.map((w) => (
            <li key={w.name}>
              {w.name}: <span className="text-foreground">{w.value}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Context input */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold">Context input: wave_number</h2>
        <p className="text-sm text-muted-foreground">
          From Engine 1 (wave_engine_state). Used in bias and warnings.
        </p>
        <p className="mt-2 text-sm font-mono">
          {WAVE_NUMBER_VALUES.join(" | ")}
        </p>
      </section>

      {/* Decision ladder: Steps 1, 2, 3 */}
      <p className="text-sm text-muted-foreground">
        Numbers below are defaults; the <Link href="/engine2?tab=diagnostics" className="text-primary underline">Diagnostics</Link> tab shows rules for the version currently in use in <Link href="/engine2?tab=tune" className="text-primary underline">Tune</Link>.
      </p>
      {ENGINE2_DECISION_FLOW.map((step) => (
        <section
          key={step.id}
          className="rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <h2 className="mb-3 text-base font-semibold">
            Step {step.stepNumber} — {step.title}
          </h2>
          <div className="overflow-x-auto">
            <pre className="whitespace-pre rounded-md border border-border bg-muted/50 px-4 py-3 font-mono text-sm leading-relaxed">
              {step.ladder.map((r) => `${r.condition}  ${r.outcome}`).join("\n")}
            </pre>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Display (diagnostics)
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {step.display.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      {/* After the ladder */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-2 text-base font-semibold">After the ladder</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="font-medium text-muted-foreground">Stack rail / key factor: </span>
            <code className="whitespace-nowrap rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {AFTER_LADDER.stackRail}
            </code>
          </li>
          <li>
            <span className="font-medium text-muted-foreground">Divergence & warnings: </span>
            <span className="text-muted-foreground">{AFTER_LADDER.divergenceWarnings}</span>
          </li>
        </ul>
      </section>

      <div className="pb-8 text-sm text-muted-foreground">
        <p>
          Interpretive layer: <code className="rounded bg-muted px-1 py-0.5 text-xs">interpretation-engine.ts</code>.
          Composite alignment_score is computed upstream (DB/runner).
        </p>
      </div>
    </main>
  );
}
