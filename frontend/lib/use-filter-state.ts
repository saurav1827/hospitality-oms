'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { FilterState, FilterGroup, FilterCondition, DateRange, MultiSelectOption } from './filters';

interface UseFilterStateOptions<T> {
  defaultPageSize?: number;
  defaultSortBy?: string;
  defaultSortOrder?: 'asc' | 'desc';
  searchFields?: (keyof T | string)[];
  persistToUrl?: boolean;
  urlKeyPrefix?: string;
}

export function useFilterState<T>(options: UseFilterStateOptions<T> = {}) {
  const {
    defaultPageSize = 10,
    defaultSortBy = 'createdAt',
    defaultSortOrder = 'desc',
    searchFields = [],
    persistToUrl = false,
    urlKeyPrefix = '',
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Refs so the callbacks below stay stable across renders without needing
  // router/pathname/searchParams in their dependency arrays.
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  const searchParamsRef = useRef(searchParams);
  pathnameRef.current = pathname;
  routerRef.current = router;
  searchParamsRef.current = searchParams;

  const parseUrlState = useCallback((params: URLSearchParams): Partial<FilterState<T>> => {
    if (!persistToUrl) return {};
    const state: Partial<FilterState<T>> = {};

    const search = params.get(`${urlKeyPrefix}search`);
    if (search) state.searchQuery = search;

    const filtersParam = params.get(`${urlKeyPrefix}filters`);
    if (filtersParam) {
      try {
        state.filters = JSON.parse(decodeURIComponent(filtersParam));
      } catch {
        // Malformed/stale filter param in the URL — ignore it rather than crash the page.
      }
    }

    const dateFrom = params.get(`${urlKeyPrefix}dateFrom`);
    const dateTo = params.get(`${urlKeyPrefix}dateTo`);
    if (dateFrom || dateTo) {
      state.dateRange = {
        from: dateFrom ? new Date(dateFrom) : null,
        to: dateTo ? new Date(dateTo) : null,
      };
    }

    const sortBy = params.get(`${urlKeyPrefix}sortBy`);
    if (sortBy) state.sortBy = sortBy;

    const sortOrder = params.get(`${urlKeyPrefix}sortOrder`);
    if (sortOrder === 'asc' || sortOrder === 'desc') state.sortOrder = sortOrder;

    const page = params.get(`${urlKeyPrefix}page`);
    if (page && !Number.isNaN(parseInt(page, 10))) state.page = parseInt(page, 10);

    const pageSize = params.get(`${urlKeyPrefix}pageSize`);
    if (pageSize && !Number.isNaN(parseInt(pageSize, 10))) state.pageSize = parseInt(pageSize, 10);

    return state;
  }, [persistToUrl, urlKeyPrefix]);

  // IMPORTANT: the URL is read exactly ONCE, here, to support shareable / bookmarkable
  // links on first load. We deliberately do NOT keep re-syncing from `searchParams`
  // after mount. Every setter below also *writes* to the URL — a bidirectional sync
  // (state -> URL -> state -> URL -> ...) is what was causing the page to feel like
  // it was "reloading" on every keystroke or filter click.
  const [state, setState] = useState<FilterState<T>>(() => ({
    searchQuery: '',
    filters: [],
    dateRange: null,
    sortBy: defaultSortBy,
    sortOrder: defaultSortOrder,
    page: 1,
    pageSize: defaultPageSize,
    searchConfig: { fields: searchFields },
    ...parseUrlState(searchParamsRef.current),
  }));

  const buildQueryString = useCallback((s: FilterState<T>) => {
    const params = new URLSearchParams(searchParamsRef.current.toString());

    const setOrDelete = (key: string, value: string | null) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    setOrDelete(`${urlKeyPrefix}search`, s.searchQuery ? s.searchQuery : null);
    setOrDelete(`${urlKeyPrefix}filters`, s.filters.length > 0 ? encodeURIComponent(JSON.stringify(s.filters)) : null);
    setOrDelete(`${urlKeyPrefix}dateFrom`, s.dateRange?.from ? s.dateRange.from.toISOString() : null);
    setOrDelete(`${urlKeyPrefix}dateTo`, s.dateRange?.to ? s.dateRange.to.toISOString() : null);
    setOrDelete(`${urlKeyPrefix}sortBy`, s.sortBy !== defaultSortBy ? s.sortBy : null);
    setOrDelete(`${urlKeyPrefix}sortOrder`, s.sortOrder !== defaultSortOrder ? s.sortOrder : null);
    setOrDelete(`${urlKeyPrefix}page`, s.page !== 1 ? String(s.page) : null);
    setOrDelete(`${urlKeyPrefix}pageSize`, s.pageSize !== defaultPageSize ? String(s.pageSize) : null);

    return params.toString();
  }, [urlKeyPrefix, defaultSortBy, defaultSortOrder, defaultPageSize]);

  // Debounced, loop-safe URL write:
  //  - debounced so rapid typing doesn't spam router.replace()
  //  - skips the replace entirely when the resulting query string hasn't changed
  const urlWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateUrl = useCallback((newState: FilterState<T>) => {
    if (!persistToUrl) return;
    if (urlWriteTimer.current) clearTimeout(urlWriteTimer.current);
    urlWriteTimer.current = setTimeout(() => {
      const nextQuery = buildQueryString(newState);
      const currentQuery = searchParamsRef.current.toString();
      if (nextQuery === currentQuery) return;
      routerRef.current.replace(`${pathnameRef.current}?${nextQuery}`, { scroll: false });
    }, 250);
  }, [persistToUrl, buildQueryString]);

  useEffect(() => {
    return () => {
      if (urlWriteTimer.current) clearTimeout(urlWriteTimer.current);
    };
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => {
      const newState = { ...prev, searchQuery: query, page: 1 };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl]);

  const setFilters = useCallback((filters: FilterGroup<T>[]) => {
    setState(prev => {
      const newState = { ...prev, filters, page: 1 };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl]);

  const addFilter = useCallback((groupId: string, condition: FilterCondition<T>) => {
    setState(prev => {
      const newFilters = [...prev.filters];
      const groupIndex = newFilters.findIndex(g => g.id === groupId);

      if (groupIndex >= 0) {
        newFilters[groupIndex] = {
          ...newFilters[groupIndex],
          conditions: [...newFilters[groupIndex].conditions, condition],
        };
      } else {
        newFilters.push({
          id: groupId,
          label: groupId,
          conditions: [condition],
          // Same-field conditions (e.g. status=A, status=B) should be OR'd —
          // an item can't equal two different values of the same field at once.
          logic: 'OR',
        });
      }

      const newState = { ...prev, filters: newFilters, page: 1 };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl]);

  const removeFilter = useCallback((groupId: string, conditionIndex?: number) => {
    setState(prev => {
      const newFilters = prev.filters
        .map(group => {
          if (group.id !== groupId) return group;
          if (conditionIndex === undefined) return null;
          return {
            ...group,
            conditions: group.conditions.filter((_, i) => i !== conditionIndex),
          };
        })
        .filter((g): g is FilterGroup<T> => g !== null && g.conditions.length > 0);

      const newState = { ...prev, filters: newFilters, page: 1 };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl]);

  const clearFilters = useCallback((groupId?: string) => {
    setState(prev => {
      const newFilters = groupId
        ? prev.filters.filter(g => g.id !== groupId)
        : [];
      const newState = { ...prev, filters: newFilters, page: 1 };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl]);

  const clearAllFilters = useCallback(() => {
    setState(prev => {
      const newState = {
        ...prev,
        searchQuery: '',
        filters: [],
        dateRange: null,
        page: 1,
        sortBy: defaultSortBy,
        sortOrder: defaultSortOrder,
      };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl, defaultSortBy, defaultSortOrder]);

  const setDateRange = useCallback((range: DateRange | null) => {
    setState(prev => {
      const newState = { ...prev, dateRange: range, page: 1 };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl]);

  const setSort = useCallback((sortBy: string, sortOrder?: 'asc' | 'desc') => {
    setState(prev => {
      const newSortOrder = sortOrder ?? (prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc');
      const newState = { ...prev, sortBy, sortOrder: newSortOrder };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl]);

  const setPage = useCallback((pageOrFn: number | ((prev: number) => number)) => {
    setState(prev => {
      const newPage = typeof pageOrFn === 'function' ? pageOrFn(prev.page) : pageOrFn;
      const newState = { ...prev, page: Math.max(1, newPage) };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl]);

  const setPageSize = useCallback((pageSize: number) => {
    setState(prev => {
      const newState = { ...prev, pageSize, page: 1 };
      updateUrl(newState);
      return newState;
    });
  }, [updateUrl]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (state.searchQuery.trim()) count++;
    count += state.filters.reduce((sum, g) => sum + g.conditions.length, 0);
    if (state.dateRange?.from || state.dateRange?.to) count++;
    return count;
  }, [state.searchQuery, state.filters, state.dateRange]);

  return {
    state,
    setSearchQuery,
    setFilters,
    addFilter,
    removeFilter,
    clearFilters,
    clearAllFilters,
    setDateRange,
    setSort,
    setPage,
    setPageSize,
    activeFilterCount,
    updateUrl,
  };
}

export function createMultiSelectFilterHandler<T>(
  groupId: string,
  options: MultiSelectOption[],
  getValue: (item: T) => string | string[],
  addFilter: (groupId: string, condition: FilterCondition<T>) => void,
  removeFilter: (groupId: string, conditionIndex?: number) => void,
  currentConditions: FilterCondition<T>[]
) {
  const selectedValues = currentConditions.map(c => c.value);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      const index = currentConditions.findIndex(c => c.value === value);
      if (index >= 0) removeFilter(groupId, index);
    } else {
      const option = options.find(o => o.value === value);
      addFilter(groupId, {
        field: 'status',
        operator: 'equals',
        value,
        label: option?.label || value,
      });
    }
  };

  const isSelected = (value: string) => selectedValues.includes(value);

  return { toggleOption, isSelected, selectedValues };
}