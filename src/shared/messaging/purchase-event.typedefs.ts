export interface PurchaseEventTicket {
  id: string;
  code: string;
  tierName: string;
}

export interface PurchaseEventDetails {
  id: string;
  title: string;
  performerName: string;
  venueName: string;
  startsAt: string;
}

export interface PurchaseCompletedEvent {
  id: string;
  type: 'purchase.completed';
  occurredAt: string;
  orderId: string;
  customerEmail: string;
  totalCents: number;
  currency: string;
  event: PurchaseEventDetails;
  tickets: PurchaseEventTicket[];
}
