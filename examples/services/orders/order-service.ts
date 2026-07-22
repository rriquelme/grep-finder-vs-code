// services/orders/order-service.ts — order workflow that bills the customer.
import { calculateInvoiceTotal } from '../../billing/invoice';

interface Order {
  id: string;
  lines: { price: number; quantity: number }[];
}

// TODO: unify rounding across services (grep-finder demo).
export function chargeOrder(order: Order): number {
  const total = calculateInvoiceTotal(order.lines);
  if (total <= 0) {
    throw new Error(`Order ${order.id} has a non-positive total`);
  }
  return total;
}
