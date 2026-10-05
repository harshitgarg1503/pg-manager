const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatINR(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  return inr.format(value);
}
