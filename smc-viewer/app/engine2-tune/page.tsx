"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Engine2Nav } from "@/components/engine2-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_ENGINE2_LOGIC,
  ENGINE2_LOGIC_ENTRIES,
  getConfig,
  type Engine2LogicConfig,
} from "@/lib/engine2-logic-config";
import {
  createVersion,
  getActiveOverrides,
  getVersionStore,
  setActiveVersionId,
  type Engine2LogicVersion,
} from "@/lib/engine2-version-store";
import { Settings2, Check, Beaker } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  alignment: "Step 1: Alignment",
  confidence: "Step 2: Confidence",
  stack: "Stack aligned",
  bias: "Step 3: Bias",
  key_factors: "Key factors",
  warnings: "Warnings",
};

function useEngine2TuneState() {
  const [mounted, setMounted] = useState(false);
  const [storeVersions, setStoreVersions] = useState<Engine2LogicVersion[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<Engine2LogicConfig>(DEFAULT_ENGINE2_LOGIC);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    const store = getVersionStore();
    setStoreVersions(store.versions);
    setActiveId(store.activeVersionId);
    const overrides = getActiveOverrides();
    const config = getConfig(overrides);
    setCurrentConfig(config);
    setFormValues(
      Object.fromEntries(
        ENGINE2_LOGIC_ENTRIES.map((e) => [e.key, String(config[e.key])])
      )
    );
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    refresh();
  }, [mounted, refresh]);

  return { mounted, currentConfig, formValues, setFormValues, storeVersions, activeId, refresh };
}

export default function Engine2TunePage() {
  const {
    mounted,
    currentConfig,
    formValues,
    setFormValues,
    storeVersions,
    activeId,
    refresh,
  } = useEngine2TuneState();

  const handleSetActive = useCallback(
    (id: string | null) => {
      setActiveVersionId(id);
      refresh();
    },
    [refresh]
  );

  const handleApply = useCallback(() => {
    const next: Record<string, number> = { ...DEFAULT_ENGINE2_LOGIC };
    for (const entry of ENGINE2_LOGIC_ENTRIES) {
      const raw = formValues[entry.key];
      const n = raw != null && raw !== "" ? parseFloat(raw) : currentConfig[entry.key];
      if (Number.isFinite(n)) next[entry.key] = n;
    }
    createVersion(next as Engine2LogicConfig);
    refresh();
  }, [formValues, currentConfig, refresh]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-4xl px-4 py-8 text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const byCategory = ENGINE2_LOGIC_ENTRIES.reduce<
    Record<string, typeof ENGINE2_LOGIC_ENTRIES>
  >((acc, entry) => {
    const cat = entry.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry);
    return acc;
  }, {});

  const categoryOrder = [
    "alignment",
    "confidence",
    "stack",
    "bias",
    "key_factors",
    "warnings",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Settings2 className="size-6 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold">Engine 2 tune</h1>
              <p className="text-sm text-muted-foreground">
                Adjust logic gates; apply to create a new version. Active version affects interpretation when overrides are sent.
              </p>
            </div>
          </div>
          <Engine2Nav />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* Version list: switch and see which is in use */}
        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
            <CardDescription>
              Default uses built-in thresholds. Create versions to override. Switch to the version you want the interpretation API to use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Currently in use:{" "}
              <span className="font-medium text-foreground">
                {activeId === null ? "Default" : storeVersions.find((v) => v.id === activeId)?.name ?? activeId}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={activeId === null ? "default" : "outline"}
                size="sm"
                onClick={() => handleSetActive(null)}
              >
                {activeId === null ? <Check className="mr-1 size-3.5" /> : null}
                Use Default
              </Button>
              {storeVersions.map((v) => (
                <Button
                  key={v.id}
                  variant={activeId === v.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSetActive(v.id)}
                >
                  {activeId === v.id ? <Check className="mr-1 size-3.5" /> : null}
                  Use {v.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active logic: exact thresholds used site-wide so you can verify */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="size-5 text-muted-foreground" />
              Active logic (used site-wide)
            </CardTitle>
            <CardDescription>
              These are the exact threshold values applied everywhere: chart interpretation, multi-timeframe view, and diagnostics. Compare with the table below to verify the version in use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Version: <span className="font-semibold text-foreground">
                {activeId === null ? "Default" : storeVersions.find((v) => v.id === activeId)?.name ?? activeId}
              </span>
            </p>
            <div className="rounded-md border border-border bg-muted/30 font-mono text-sm">
              <table className="w-full border-collapse">
                <tbody>
                  {ENGINE2_LOGIC_ENTRIES.map((entry) => (
                    <tr key={entry.key} className="border-b border-border/50 last:border-b-0">
                      <td className="py-1.5 pr-4 pl-3 text-muted-foreground">{entry.key}</td>
                      <td className="py-1.5 pr-3 text-foreground tabular-nums">{currentConfig[entry.key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Form: table with aligned columns; one column per version + New */}
        <Card>
          <CardHeader>
            <CardTitle>Logic gates</CardTitle>
            <CardDescription>
              Edit the New column and click Apply to save a new version. Saved versions appear as columns so you can compare.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="w-[220px] py-2 pr-4 text-left font-medium text-muted-foreground">
                      Parameter
                    </th>
                    <th
                      className={`w-[72px] py-2 px-1 text-center font-medium cursor-pointer select-none rounded-t transition-colors ${activeId === null ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                      onClick={() => handleSetActive(null)}
                      title="Use Default"
                    >
                      <div>Default</div>
                      {activeId === null && (
                        <div className="text-xs font-normal text-primary">In use</div>
                      )}
                    </th>
                    {storeVersions.map((v) => (
                      <th
                        key={v.id}
                        className={`w-[72px] py-2 px-1 text-center font-medium cursor-pointer select-none rounded-t transition-colors ${activeId === v.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                        onClick={() => handleSetActive(v.id)}
                        title={`Use ${v.name}`}
                      >
                        <div>{v.name}</div>
                        {activeId === v.id && (
                          <div className="text-xs font-normal text-primary">In use</div>
                        )}
                      </th>
                    ))}
                    <th className="w-[72px] py-2 pl-2 text-center font-medium text-muted-foreground">
                      New
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categoryOrder.map((cat) => {
                    const entries = byCategory[cat];
                    if (!entries?.length) return null;
                    return (
                      <Fragment key={cat}>
                        <tr>
                          <td
                            colSpan={3 + storeVersions.length}
                            className="border-b border-border/60 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            {CATEGORY_LABELS[cat] ?? cat}
                          </td>
                        </tr>
                        {entries.map((entry) => (
                          <tr
                            key={entry.key}
                            className="border-b border-border/40 hover:bg-muted/20"
                          >
                            <td className="py-2 pr-4">
                              <div className="font-medium">{entry.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {entry.description}
                              </div>
                            </td>
                            <td
                              className={`py-2 px-1 text-center font-mono tabular-nums ${activeId === null ? "bg-primary/10" : ""}`}
                            >
                              {DEFAULT_ENGINE2_LOGIC[entry.key]}
                            </td>
                            {storeVersions.map((v) => (
                              <td
                                key={v.id}
                                className={`py-2 px-1 text-center font-mono tabular-nums ${activeId === v.id ? "bg-primary/10" : ""}`}
                              >
                                {v.values[entry.key]}
                              </td>
                            ))}
                            <td className="py-2 pl-2">
                              <Input
                                type="number"
                                step="0.05"
                                min="0"
                                max="1"
                                className="h-8 w-16 font-mono tabular-nums"
                                value={formValues[entry.key] ?? ""}
                                onChange={(e) =>
                                  setFormValues((prev) => ({
                                    ...prev,
                                    [entry.key]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Button onClick={handleApply}>Apply (save as new version)</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
