import type { ReactNode } from 'react';
import type { PublicEventCard, PublicTier, Tier } from '@/typedefs/catalog.typedefs';
import type { CustomerOrder } from '@/typedefs/orders.typedefs';

export interface ChildrenProps {
  children: ReactNode;
}

export interface IconProps {
  name: string;
  className?: string;
}

export interface StatusBadgeProps {
  status: string;
  plain?: boolean;
}

export interface PageLoaderProps {
  text?: string;
}

export interface ErrorBoxProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export interface EmptyStateProps {
  iconName?: string;
  title: string;
  text: string;
  action?: ReactNode;
}

export interface SectionHeadProps {
  eyebrow: string;
  title: string;
  text?: string;
  action?: ReactNode;
}

export type StatTone = 'brand' | 'ok' | 'warn' | 'info';

export interface StatCardProps {
  labelText: string;
  value: number | string;
  hint: string;
  iconName: string;
  tone?: StatTone;
}

export interface EventCardProps {
  event: PublicEventCard;
}

export interface PublicFilterState {
  search: string;
  performerId: string;
  from: string;
  to: string;
}

export interface EventFiltersProps {
  initial: PublicFilterState;
  onSubmit: (filters: PublicFilterState) => void;
  onReset: () => void;
}

export interface OrderFilterState {
  performerId: string;
  from: string;
  to: string;
}

export interface OrderFiltersProps {
  initial: OrderFilterState;
  onSubmit: (filters: OrderFilterState) => void;
  onReset: () => void;
}

export interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}

export interface ForbiddenProps {
  standalone?: boolean;
}

export interface TierRowProps {
  tier: PublicTier;
  eventId: string;
  eventStatus: string;
}

export interface TierEditorProps {
  tier: Tier;
  onChanged: () => void;
}

export interface HeroTicketProps {
  event: PublicEventCard | undefined;
}

export interface TicketCardProps {
  item: CustomerOrder;
}

export interface TicketQrProps {
  token: string;
}

export type ToastTone = 'ok' | 'error';

export interface FilterOption {
  key: string;
  label: string;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface ToastValue {
  push: (message: string, tone?: ToastTone) => void;
}
