export type FilterOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn';

export interface FilterCondition<T> {
  field: keyof T | string;
  operator: FilterOperator;
  value: any;
  label?: string;
}

export interface FilterGroup<T> {
  id: string;
  label: string;
  conditions: FilterCondition<T>[];
  logic: 'AND' | 'OR';
}

export interface SearchConfig<T> {
  fields: (keyof T | string)[];
  placeholder?: string;
  debounceMs?: number;
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface FilterState<T> {
  searchQuery: string;
  filters: FilterGroup<T>[];
  dateRange: DateRange | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
  searchConfig?: SearchConfig<T>;
}

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
  color?: string;
}

export const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: 'new', label: 'New', color: 'blue' },
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'preparing', label: 'Preparing', color: 'amber' },
  { value: 'ready', label: 'Ready', color: 'emerald' },
  { value: 'assigned', label: 'Assigned', color: 'amber' },
  { value: 'served', label: 'Served', color: 'zinc' },
  { value: 'paid', label: 'Paid', color: 'purple' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
];

export const DELIVERY_STATUS_OPTIONS: MultiSelectOption[] = [
  { value: 'new', label: 'New', color: 'blue' },
  { value: 'ready', label: 'Ready', color: 'emerald' },
  { value: 'assigned', label: 'Assigned', color: 'amber' },
  { value: 'delivered', label: 'Delivered', color: 'zinc' },
  { value: 'completed', label: 'Completed', color: 'emerald' },
];

export const ORDER_TYPE_OPTIONS: MultiSelectOption[] = [
  { value: 'dine-in', label: 'Dine-In' },
  { value: 'room-service', label: 'Room Service' },
  { value: 'takeaway', label: 'Takeaway' },
];

export function evaluateFilter<T>(item: T, condition: FilterCondition<T>): boolean {
  const fieldValue = getNestedValue(item, condition.field);
  const filterValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === filterValue;
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'startsWith':
      return String(fieldValue).toLowerCase().startsWith(String(filterValue).toLowerCase());
    case 'endsWith':
      return String(fieldValue).toLowerCase().endsWith(String(filterValue).toLowerCase());
    case 'gt':
      return Number(fieldValue) > Number(filterValue);
    case 'gte':
      return Number(fieldValue) >= Number(filterValue);
    case 'lt':
      return Number(fieldValue) < Number(filterValue);
    case 'lte':
      return Number(fieldValue) <= Number(filterValue);
    case 'in':
      return Array.isArray(filterValue) && filterValue.includes(fieldValue);
    case 'notIn':
      return Array.isArray(filterValue) && !filterValue.includes(fieldValue);
    default:
      return true;
  }
}

export function evaluateFilterGroup<T>(item: T, group: FilterGroup<T>): boolean {
  const results = group.conditions.map(c => evaluateFilter(item, c));
  return group.logic === 'AND' ? results.every(r => r) : results.some(r => r);
}

// Coerces numeric-looking strings (e.g. order totals like "1250.00") to numbers
// so sorting compares them by value instead of lexicographically, where "9" > "10".
function toComparable(value: any): any {
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

export function applyFilters<T>(items: T[], state: FilterState<T>): T[] {
  let result = [...items];

  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase();
    result = result.filter(item => {
      return (state.searchConfig?.fields || []).some(field => {
        const value = getNestedValue(item, field);
        return String(value).toLowerCase().includes(query);
      });
    });
  }

  if (state.filters.length > 0) {
    result = result.filter(item =>
      state.filters.every(group => evaluateFilterGroup(item, group))
    );
  }

  if (state.dateRange?.from || state.dateRange?.to) {
    result = result.filter(item => {
      const dateValue = getNestedValue(item, 'createdAt') || getNestedValue(item, 'date');
      if (!dateValue) return false;
      const itemDate = new Date(dateValue);
      if (state.dateRange?.from && itemDate < state.dateRange.from) return false;
      if (state.dateRange?.to && itemDate > state.dateRange.to) return false;
      return true;
    });
  }

  if (state.sortBy) {
    result.sort((a, b) => {
      const aVal = toComparable(getNestedValue(a, state.sortBy));
      const bVal = toComparable(getNestedValue(b, state.sortBy));
      const order = state.sortOrder === 'asc' ? 1 : -1;
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1 * order;
      if (bVal == null) return -1 * order;
      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      return 0;
    });
  }

  return result;
}

export function getNestedValue(obj: any, path: string | keyof any): any {
  if (!obj) return undefined;
  const keys = String(path).split('.');
  return keys.reduce((o, k) => (o ? o[k] : undefined), obj);
}

export function buildSearchConfig<T>(fields: (keyof T | string)[]): SearchConfig<T> {
  return { fields };
}

export function createFilterCondition<T>(
  field: keyof T | string,
  operator: FilterOperator,
  value: any,
  label?: string
): FilterCondition<T> {
  return { field, operator, value, label };
}

export function createFilterGroup<T>(
  id: string,
  label: string,
  conditions: FilterCondition<T>[],
  logic: 'AND' | 'OR' = 'AND'
): FilterGroup<T> {
  return { id, label, conditions, logic };
}

export function getActiveFilterCount<T>(state: FilterState<T>): number {
  let count = 0;
  if (state.searchQuery.trim()) count++;
  count += state.filters.reduce((sum, g) => sum + g.conditions.length, 0);
  if (state.dateRange?.from || state.dateRange?.to) count++;
  return count;
}