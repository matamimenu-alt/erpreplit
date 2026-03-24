import { format, parseISO } from "date-fns";

export function formatSAR(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return "SAR 0.00";
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "-";
  try {
    const date = typeof dateString === 'string' && dateString.includes('T') 
      ? parseISO(dateString) 
      : new Date(dateString);
    return format(date, "MMM dd, yyyy");
  } catch (e) {
    return dateString;
  }
}

export function formatMonth(monthStr: string | undefined | null): string {
  if (!monthStr) return "All Time";
  try {
    // Expects "YYYY-MM"
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, "MMMM yyyy");
  } catch (e) {
    return monthStr;
  }
}
