/**
 * Format a number as Lesotho Maloti.
 * Spec: "M 200.00" format used everywhere in the UI and on receipts.
 */
export function formatM(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return `M ${value.toLocaleString("en-LS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
