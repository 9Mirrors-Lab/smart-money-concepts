/**
 * Current Eastern zone abbreviation (EST or EDT).
 */
export function getEasternZoneLabel(): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
  const parts = formatter.formatToParts(new Date());
  const tz = parts.find((p) => p.type === "timeZoneName");
  return tz?.value ?? "Eastern";
}

/**
 * Format an ISO timestamp as 12-hour AM/PM in Eastern (EST/EDT).
 * Assumes input is UTC if it ends with 'Z' or '+00:00', otherwise appends 'Z'.
 * Returns "—" if the value is missing or invalid.
 */
export function formatTimestampEST(isoString: string | null | undefined): string {
  if (isoString == null || String(isoString).trim() === "") return "—";
  const raw = String(isoString).trim();
  const normalized =
    raw.endsWith("Z") || raw.endsWith("+00:00") || /[+-]\d{2}:\d{2}$/.test(raw)
      ? raw
      : raw + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

/**
 * Convert UTC time (HH:MM or HH:MM:SS) to Eastern 12-hour AM/PM.
 * Returns the formatted string or null if input is invalid.
 */
export function utcTimeToEastern(utcTime: string): string | null {
  const trimmed = utcTime.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const second = parseInt(match[3] ?? "0", 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }
  const iso = `2000-01-01T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}Z`;
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  if (second > 0) options.second = "2-digit";
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

/**
 * Parse Eastern time input: supports "H:MM AM/PM" or "HH:MM" (24h).
 * Returns [hour24, minute, second] or null if invalid.
 */
function parseEasternTime(input: string): [number, number, number] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withAmPm = trimmed.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
  );
  if (withAmPm) {
    let hour = parseInt(withAmPm[1], 10);
    const minute = parseInt(withAmPm[2], 10);
    const second = parseInt(withAmPm[3] ?? "0", 10);
    const isPm = withAmPm[4].toUpperCase() === "PM";
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return null;
    }
    if (hour === 12) hour = isPm ? 12 : 0;
    else if (isPm) hour += 12;
    return [hour, minute, second];
  }

  const plain24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (plain24) {
    const hour = parseInt(plain24[1], 10);
    const minute = parseInt(plain24[2], 10);
    const second = parseInt(plain24[3] ?? "0", 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return null;
    }
    return [hour, minute, second];
  }
  return null;
}

/**
 * Convert Eastern time (HH:MM AM/PM or HH:MM 24h) to UTC.
 * Uses a reference date to respect DST. Returns the formatted string or null if invalid.
 */
export function easternTimeToUtc(easternTime: string): string | null {
  const parsed = parseEasternTime(easternTime);
  if (!parsed) return null;
  const [hour, minute, second] = parsed;
  const now = new Date();
  const refDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const iso = `${refDate}T${String(utcHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}Z`;
    const date = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    if (second > 0) opts.second = "2-digit";
    const formatted = new Intl.DateTimeFormat("en-US", opts).format(date);
    const parts = formatted.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!parts) continue;
    const fh = parseInt(parts[1], 10);
    const fm = parseInt(parts[2], 10);
    const fs = parts[3] ? parseInt(parts[3], 10) : 0;
    if (fh === hour && fm === minute && fs === second) {
      const sec = second > 0 ? `:${String(second).padStart(2, "0")}` : "";
      return `${String(utcHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}${sec}`;
    }
  }
  return null;
}
