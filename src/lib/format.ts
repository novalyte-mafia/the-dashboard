// Client-safe formatting & helper utilities.
// IMPORTANT: This module must NOT import db, auth, or any server-only code.
import { stageLabel, contactTypeLabel, dealStageLabel, directoryStageLabel } from "@/lib/constants";

export { stageLabel, contactTypeLabel, dealStageLabel, directoryStageLabel };

export function formatCurrency(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatCurrencyFull(n: number | null | undefined): string {
  return `$${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
}

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.round(day / 7)}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function localTime(timezone: string | null | undefined): string {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: timezone || "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
}

export function localHour(timezone: string | null | undefined): number {
  try {
    const h = parseInt(
      new Date()
        .toLocaleTimeString("en-US", { timeZone: timezone || "America/New_York", hour: "2-digit", hour12: false })
        .replace(/\s.*$/, ""),
      10
    );
    return isNaN(h) ? 12 : h;
  } catch {
    return new Date().getHours();
  }
}

export function isWithinCallingHours(timezone: string | null | undefined, start = 8, end = 20): boolean {
  const h = localHour(timezone);
  return h >= start && h < end;
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase() || "?";
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ") || "Unnamed";
}
