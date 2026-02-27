"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { Check, Beaker, Copy, ClipboardCheck } from "lucide-react";

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

export function Engine2TuneContent() {
  const {
    mounted,
    currentConfig,
    formValues,
    setFormValues,
    storeVersions,
    activeId,
    refresh,
  } = useEngine2TuneState();
  const [copied, setCopied] = useState(false);

  const handleSetActive = useCallback(
    (id: string | null) => {
      setActiveVersionId(id);
      refresh();
    },
    [refresh]
  );

  const handleCopyActive = useCallback(() => {
    const versionName = activeId === null ? "Default" : storeVersions.find((v) => v.id === activeId)?.name ?? activeId;
    const lines = ENGINE2_LOGIC_ENTRIES.map(
      (e) => `${e.key}: ${currentConfig[e.key]}`
    );
    const text = `# Active logic — ${versionName}\n${lines.join("\n")}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [activeId, storeVersions, currentConfig]);

  const handleApply = useCallback(() => {
    const next: Record<string, number> = { ...DEFAULT_ENGINE2_LOGIC };
    for (const entry of ENGINE2_LOGIC_ENTRIES) {
      const raw = formValues[entry.key];
      const n = raw != null && raw !== "" ? parseFloat(raw) : currentConfig[entry.key];
      if (Number.isFinite(n)) next[entry.key] = n;
    }
    createVersion(next as unknown as Engine2LogicConfig);
    refresh();
  }, [formValues, currentConfig, refresh]);

  if (!mounted) {
    return (
      <div className="w-full max-w-4xl px-4 py-8 text-muted-foreground">
        Loading…
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
    <main className="w-full max-w-5xl space-y-6 px-4 py-6">
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
              variant="outline"
              size="sm"
              onClick={() => handleSetActive(null)}
              className={activeId === null ? "border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300" : ""}
            >
              {activeId === null ? <Check className="size-3.5" /> : null}
              Use Default
            </Button>
            {storeVersions.map((v) => (
              <Button
                key={v.id}
                variant="outline"
                size="sm"
                onClick={() => handleSetActive(v.id)}
                className={activeId === v.id ? "border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300" : ""}
              >
                {activeId === v.id ? <Check className="size-3.5" /> : null}
                Use {v.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="size-5 text-muted-foreground" />
            Logic gates
          </CardTitle>
          <CardDescription>
            Active shows the exact value in use site-wide. Edit the New column and click Apply to save a new version. Saved versions appear as columns so you can compare.
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
                  <th className="w-[72px] px-1 py-2 text-center font-medium text-amber-500/80">
                    <div>Active</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {activeId === null ? "Default" : storeVersions.find((v) => v.id === activeId)?.name ?? activeId}
                    </div>
                  </th>
                  <th
                    className={`w-[72px] cursor-pointer select-none px-1 py-2 text-center font-medium transition-colors ${activeId === null ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
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
                      className={`w-[72px] cursor-pointer select-none px-1 py-2 text-center font-medium transition-colors ${activeId === v.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                      onClick={() => handleSetActive(v.id)}
                      title={`Use ${v.name}`}
                    >
                      <div>{v.name}</div>
                      {activeId === v.id && (
                        <div className="text-xs font-normal text-primary">In use</div>
                      )}
                    </th>
                  ))}
                  <th className="min-w-[96px] w-24 pl-2 py-2 text-center font-medium text-muted-foreground">
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
                          colSpan={4 + storeVersions.length}
                          className="border-b border-border/60 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
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
                            <div className="mt-0.5 font-mono text-xs text-muted-foreground/60">
                              {entry.key}
                            </div>
                          </td>
                          <td className="px-1 py-2 text-center font-mono tabular-nums font-semibold text-amber-500/90">
                            {currentConfig[entry.key]}
                          </td>
                          <td
                            className={`px-1 py-2 text-center font-mono tabular-nums ${activeId === null ? "bg-primary/10" : ""}`}
                          >
                            {DEFAULT_ENGINE2_LOGIC[entry.key]}
                          </td>
                          {storeVersions.map((v) => (
                            <td
                              key={v.id}
                              className={`px-1 py-2 text-center font-mono tabular-nums ${activeId === v.id ? "bg-primary/10" : ""}`}
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
                              className="h-8 w-24 min-w-24 font-mono tabular-nums"
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
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={handleApply}>Apply (save as new version)</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyActive}
              className="gap-1.5 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
            >
              {copied ? (
                <><ClipboardCheck className="size-3.5" />Copied!</>
              ) : (
                <><Copy className="size-3.5" />Copy active</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
