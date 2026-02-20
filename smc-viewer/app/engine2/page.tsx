"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Engine2HubTabs,
  ENGINE2_TABS,
  type Engine2TabValue,
} from "@/components/engine2/hub-tabs";
import { Engine2ReferenceContent } from "@/components/engine2/reference-content";
import { Engine2DiagnosticsContent } from "@/components/engine2/diagnostics-content";
import { Engine2EvaluateContent } from "@/components/engine2/evaluate-content";
import { Engine2TuneContent } from "@/components/engine2/tune-content";
import { TabsContent } from "@/components/ui/tabs";

const VALID_TABS: Engine2TabValue[] = ["reference", "diagnostics", "evaluate", "tune"];

function getTabFromSearchParams(searchParams: URLSearchParams | null): Engine2TabValue {
  const tab = searchParams?.get("tab");
  if (tab && VALID_TABS.includes(tab as Engine2TabValue)) {
    return tab as Engine2TabValue;
  }
  return "reference";
}

function Engine2HubContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Engine2TabValue>(() =>
    getTabFromSearchParams(searchParams)
  );

  useEffect(() => {
    const next = getTabFromSearchParams(searchParams);
    setTab(next);
  }, [searchParams]);

  const handleTabChange = useCallback((value: Engine2TabValue) => {
    setTab(value);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex w-full flex-col gap-4 px-4 py-4">
          <h1 className="text-lg font-semibold">Engine 2</h1>
          <p className="text-sm text-muted-foreground">
            Engine → Interpretation → Diagnostics → Calibration. Reference, run diagnostics, evaluate, and tune.
          </p>
        </div>
        <Engine2HubTabs value={tab} onValueChange={handleTabChange}>
          {ENGINE2_TABS.map((t) => (
            <TabsContent
              key={t.value}
              value={t.value}
              className="mt-0 min-h-0 flex-1 overflow-auto focus-visible:outline-none data-[state=inactive]:hidden"
            >
              {t.value === "reference" && <Engine2ReferenceContent />}
              {t.value === "diagnostics" && <Engine2DiagnosticsContent />}
              {t.value === "evaluate" && <Engine2EvaluateContent />}
              {t.value === "tune" && <Engine2TuneContent />}
            </TabsContent>
          ))}
        </Engine2HubTabs>
      </header>
    </div>
  );
}

export default function Engine2HubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Loading Engine 2…
        </div>
      }
    >
      <Engine2HubContent />
    </Suspense>
  );
}
