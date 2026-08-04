export function usd(n: number, opts?: { cents?: boolean }): string {
  return n.toLocaleString("zh-CN", {
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
  return new Date(iso).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
