"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Engine2ChecklistContent } from "@/app/engine2-checklist/page";
import { Engine2ScorecardContent } from "@/app/engine2-scorecard/page";
import type { DiagnosticsApiResult } from "@/components/diagnostics-panel";
import {
  getLoadedAnalysisResults,
  getLatestFirstAnalysis,
  saveLoadedAnalysisResults,
  writeChecklistStateAndNotify,
} from "@/lib/engine2-checklist-types";
import { checklistFromLoadedAnalysis } from "@/lib/engine2-checklist-from-analysis";
import { TIMEFRAME_ORDER } from "@/lib/engine2-diagnostic-flow-data";
import { getActiveOverridesQueryFragment } from "@/lib/engine2-version-store";
import { Download, ClipboardCheck } from "lucide-react";

const DEFAULT_LOAD_SYMBOL = "KCEX_ETHUSDT.P";

export function Engine2EvaluateContent() {
  const [loadSymbol, setLoadSymbol] = useState(DEFAULT_LOAD_SYMBOL);
  const [loadLoading, setLoadLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [hasLoadedAnalysis, setHasLoadedAnalysis] = useState(false);

  useEffect(() => {
    setHasLoadedAnalysis(!!getLoadedAnalysisResults());
  }, []);

  const handleLoadAnalysis = useCallback(async () => {
    const symbol = loadSymbol.trim() || DEFAULT_LOAD_SYMBOL;
    setLoadError(null);
    setLoadLoading(true);
    const overridesFragment = getActiveOverridesQueryFragment();
    try {
      const results = await Promise.all(
        TIMEFRAME_ORDER.map(async (tf) => {
          const params = new URLSearchParams({ symbol, timeframe: tf, limit: "5000" });
          const res = await fetch(`/api/alignment-engine/diagnostics?${params}${overridesFragment}`);
          if (!res.ok) throw new Error(`${tf}: ${res.status}`);
          const body = (await res.json()) as DiagnosticsApiResult | { error?: string };
          if ("error" in body && body.error) throw new Error(body.error);
          return { tf, data: body as DiagnosticsApiResult };
        })
      );
      const resultsRecord: Record<string, DiagnosticsApiResult> = {};
      for (const { tf, data } of results) resultsRecord[tf] = data;
      saveLoadedAnalysisResults({ symbol, results: resultsRecord });
      setHasLoadedAnalysis(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadLoading(false);
    }
  }, [loadSymbol]);

  const handleUpdateChecklist = useCallback(() => {
    const loaded = getLoadedAnalysisResults();
    if (!loaded) {
      setLoadError("Load analysis first, or run diagnostics from the Multi-TF panel.");
      return;
    }
    setLoadError(null);
    setUpdateBusy(true);
    try {
      const diagnosticMarkdown =
        loaded.diagnosticMarkdown ||
        (getLatestFirstAnalysis()?.symbol === loaded.symbol ? getLatestFirstAnalysis()?.diagnosticMarkdown ?? "" : "");
      const state = checklistFromLoadedAnalysis({ ...loaded, diagnosticMarkdown });
      writeChecklistStateAndNotify(state);
    } finally {
      setUpdateBusy(false);
    }
  }, []);

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
        <Input
          placeholder="Symbol"
          value={loadSymbol}
          onChange={(e) => setLoadSymbol(e.target.value)}
          className="h-8 w-44 font-mono text-sm"
        />
        <Button size="sm" onClick={handleLoadAnalysis} disabled={loadLoading}>
          <Download className="mr-1.5 size-3.5" />
          {loadLoading ? "Loading…" : "Load analysis"}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleUpdateChecklist} disabled={updateBusy || !hasLoadedAnalysis}>
          <ClipboardCheck className="mr-1.5 size-3.5" />
          Update checklist
        </Button>
        {hasLoadedAnalysis && (
          <span className="text-xs text-muted-foreground">Analysis loaded. Click Update checklist to fill the checklist.</span>
        )}
        {loadError && <p className="w-full text-sm text-destructive">{loadError}</p>}
      </div>
      <ResizablePanelGroup
        orientation="horizontal"
        className="hidden min-h-0 flex-1 md:flex md:min-h-[60vh]"
      >
        <ResizablePanel defaultSize={50} minSize={28}>
          <ScrollArea className="h-full">
            <div className="w-full px-4 py-6" id="checklist">
              <h2 className="mb-4 text-base font-semibold">Checklist</h2>
              <Engine2ChecklistContent fullWidth />
            </div>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle className="w-px shrink-0" />
        <ResizablePanel defaultSize={50} minSize={28}>
          <ScrollArea className="h-full">
            <div className="w-full px-4 py-6" id="scorecard">
              <h2 className="mb-4 text-base font-semibold">Scorecard</h2>
              <Engine2ScorecardContent />
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
      {/* Single column on small screens */}
      <div className="flex flex-1 flex-col gap-8 px-4 py-6 md:hidden">
        <section id="checklist">
          <h2 className="mb-4 text-base font-semibold">Checklist</h2>
          <Engine2ChecklistContent />
        </section>
        <section id="scorecard">
          <h2 className="mb-4 text-base font-semibold">Scorecard</h2>
          <Engine2ScorecardContent />
        </section>
      </div>
    </div>
  );
}
