/**
 * Engine 2 logic version store (localStorage).
 * Versions are named v1 (default), v2, v3, … with optional display names.
 */

import type { Engine2LogicConfig, Engine2LogicOverrides } from "./engine2-logic-config";

const STORAGE_KEY = "engine2-logic-versions";
const ACTIVE_KEY = "engine2-logic-active-version-id";

export interface Engine2LogicVersion {
  id: string;
  name: string;
  /** Full snapshot; used as overrides when this version is active. */
  values: Engine2LogicConfig;
  createdAt: string;
}

export interface VersionStore {
  versions: Engine2LogicVersion[];
  activeVersionId: string | null;
}

function load(): VersionStore {
  if (typeof window === "undefined") {
    return { versions: [], activeVersionId: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const active = localStorage.getItem(ACTIVE_KEY);
    const versions: Engine2LogicVersion[] = raw ? JSON.parse(raw) : [];
    return {
      versions,
      activeVersionId: active,
    };
  } catch {
    return { versions: [], activeVersionId: null };
  }
}

function save(store: VersionStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store.versions));
  if (store.activeVersionId != null) {
    localStorage.setItem(ACTIVE_KEY, store.activeVersionId);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export function getVersionStore(): VersionStore {
  return load();
}

export function getActiveOverrides(): Engine2LogicOverrides | null {
  const { versions, activeVersionId } = load();
  if (!activeVersionId) return null;
  const v = versions.find((x) => x.id === activeVersionId);
  return v ? v.values : null;
}

export function createVersion(values: Engine2LogicConfig, name?: string): Engine2LogicVersion {
  const store = load();
  const nextNum = store.versions.length + 1;
  const id = `v${nextNum}`;
  const version: Engine2LogicVersion = {
    id,
    name: name ?? `Version ${nextNum}`,
    values: { ...values },
    createdAt: new Date().toISOString(),
  };
  store.versions.push(version);
  store.activeVersionId = id;
  save(store);
  return version;
}

export function setActiveVersionId(id: string | null) {
  const store = load();
  store.activeVersionId = id;
  save(store);
}

export function getVersionById(id: string): Engine2LogicVersion | null {
  return load().versions.find((v) => v.id === id) ?? null;
}

export function getValuesForVersionOrDefault(id: string | null): Engine2LogicConfig | null {
  if (!id) return null;
  const v = getVersionById(id);
  return v ? v.values : null;
}

/**
 * Query fragment to append to interpretation/diagnostics API URLs so the active version is used.
 * Returns "" when Default is active (no overrides). Call only on the client (uses localStorage).
 */
export function getActiveOverridesQueryFragment(): string {
  const overrides = getActiveOverrides();
  if (!overrides || Object.keys(overrides).length === 0) return "";
  return "&overrides=" + encodeURIComponent(JSON.stringify(overrides));
}
