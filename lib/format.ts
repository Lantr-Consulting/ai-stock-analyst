import { getLanguage } from "./language";

export function usd(n: number, opts?: { cents?: boolean }): string {
  return n.toLocaleString(getLanguage() === "en" ? "en-US" : "zh-CN", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts?.cents === false ? 0 : 2,
    maximumFractionDigits: opts?.cents === false ? 0 : 2,
  });
}

export function pct(n: number, digits = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(getLanguage() === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
  });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(getLanguage() === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
