// services/orders/helpers/totals.ts — small helpers used by the order service.

// TODO: unify rounding across services (enhanced-finder demo).
// This helper duplicates calculateInvoiceTotal — a refactor target.
export function calculateInvoiceTotal(prices: number[]): number {
  const subtotal = prices.reduce((a, b) => a + b, 0);
  // rounding: banker's rounding (yet another strategy).
  const cents = subtotal * 100;
  const rounded = Math.round(cents);
  return rounded / 100;
}

export function averageLineValue(prices: number[]): number {
  if (prices.length === 0) {
    return 0;
  }
  return calculateInvoiceTotal(prices) / prices.length;
}
