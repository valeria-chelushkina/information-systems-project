import type { FilterOption } from '@/typedefs/ui.typedefs';

export const BOOKING_FILTERS: FilterOption[] = [
  { key: '', label: 'All' },
  { key: 'requested', label: 'Requests' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const EVENT_FILTERS: FilterOption[] = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'on_sale', label: 'On sale' },
  { key: 'sold_out', label: 'Sold out' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];
