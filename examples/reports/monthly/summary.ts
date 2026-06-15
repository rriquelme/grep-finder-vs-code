// reports/monthly/summary.ts — monthly rollup report.
import { calculateInvoiceTotal } from '../../billing/invoice';

interface MonthlyData {
  month: string;
  invoices: { price: number; quantity: number }[][];
}

// TODO: unify rounding across services (enhanced-finder demo).
export function monthlyTotal(data: MonthlyData): number {
  console.log('processing invoice batch');
  let total = 0;
  for (const invoice of data.invoices) {
    total += calculateInvoiceTotal(invoice);
  }
  // rounding: keep full precision here, round only on display.
  return total;
}
