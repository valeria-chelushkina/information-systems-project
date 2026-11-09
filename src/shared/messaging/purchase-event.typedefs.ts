export interface PurchaseCompletedEvent {
  id: string;
  type: 'purchase.completed';
  occurredAt: string;
  orderId: string;
  showId: string;
  tierId: string;
  quantity: number;
  amountCents: number;
  currency: string;
  customerEmail: string;
  ticketIds: string[];
}
