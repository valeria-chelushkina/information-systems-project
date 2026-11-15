export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
