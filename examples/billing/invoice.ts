// billing/invoice.ts — current invoice engine.
import { LineItem } from './types';

const TAX_RATE = 0.21;

// TODO: unify rounding across services (enhanced-finder demo).
export function calculateInvoiceTotal(items: LineItem[]): number {
  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const withTax = subtotal * (1 + TAX_RATE);
  // rounding: round half up to 2 decimals.
  return Math.round(withTax * 100) / 100;
}

export function invoiceSummary(items: LineItem[]): string {
  const total = calculateInvoiceTotal(items);
  console.log('processing invoice batch');
  return `Invoice total: ${total.toFixed(2)}`;
}
