export interface ReportTotals {
  revenueCents: number;
  refundedCents: number;
  orders: number;
  ticketsSold: number;
  ticketsCheckedIn: number;
}

export interface EventReport {
  id: string;
  title: string;
  performerName: string;
  startsAt: string;
  status: string;
  ticketsSold: number;
  revenueCents: number;
  capacity: number;
  soldQty: number;
  occupancyPct: number;
}

export interface PerformerReport {
  performerId: string;
  performerName: string;
  events: number;
  ticketsSold: number;
  revenueCents: number;
}

export interface Reports {
  range: { from: string; to: string };
  totals: ReportTotals;
  byEvent: EventReport[];
  byPerformer: PerformerReport[];
}
