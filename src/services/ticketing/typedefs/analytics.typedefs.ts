export interface ReportRange {
  from: Date;
  to: Date;
}

export interface ReportTotals {
  revenueCents: number;
  refundedCents: number;
  orders: number;
  ticketsSold: number;
  ticketsCheckedIn: number;
}

export interface EventReportRow {
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

export interface PerformerReportRow {
  performerId: string;
  performerName: string;
  events: number;
  ticketsSold: number;
  revenueCents: number;
}

export interface ReportsResult {
  range: { from: string; to: string };
  totals: ReportTotals;
  byEvent: EventReportRow[];
  byPerformer: PerformerReportRow[];
}
