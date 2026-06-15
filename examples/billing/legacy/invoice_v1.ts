// billing/legacy/invoice_v1.ts — old invoice engine kept for comparison.
// Same idea as billing/invoice.ts but a different (buggy) implementation.

const OLD_TAX = 0.19;

// TODO: unify rounding across services (enhanced-finder demo).
export function calculateInvoiceTotal(items: Array<{ price: number; qty: number }>): number {
  let subtotal = 0;
  for (const it of items) {
    subtotal += it.price * it.qty;
  }
  // rounding: floor — known to be inconsistent with the new engine.
  return Math.floor(subtotal * (1 + OLD_TAX));
}

export function legacyReport(items: Array<{ price: number; qty: number }>): void {
  console.log('processing invoice batch');
  console.log('legacy total', calculateInvoiceTotal(items));
}
