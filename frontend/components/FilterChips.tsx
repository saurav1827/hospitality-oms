'use client';

import { useMemo } from 'react';
import { X, Search, Calendar, Filter, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FilterState, FilterGroup, FilterCondition, DateRange, MultiSelectOption } from '@/lib/filters';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'search' | 'date' | 'filter';
  className?: string;
}

export function FilterChip({
  label,
  onRemove,
  icon,
  variant = 'default',
  className = '',
}: FilterChipProps) {
  const variantStyles = {
    default: 'bg-zinc-800/50 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800',
    search: 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20',
    date: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
    filter: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20',
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8, x: -10 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.8, x: 10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
        border ${variantStyles[variant]} ${className}
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate max-w-[150px]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
        aria-label={`Remove filter: ${label}`}
      >
        <X size={12} />
      </button>
    </motion.span>
  );
}

interface ActiveFiltersDisplayProps {
  state: FilterState<any>;
  onRemoveSearch: () => void;
  onRemoveFilter: (groupId: string, conditionIndex: number) => void;
  onRemoveDateRange: () => void;
  onClearAll: () => void;
  filterOptions?: Record<string, MultiSelectOption[]>;
  className?: string;
  compact?: boolean;
}

export function ActiveFiltersDisplay({
  state,
  onRemoveSearch,
  onRemoveFilter,
  onRemoveDateRange,
  onClearAll,
  filterOptions = {},
  className = '',
  compact = false,
}: ActiveFiltersDisplayProps) {
  const activeFilters = useMemo(() => {
    const filters: Array<{
      id: string;
      label: string;
      onRemove: () => void;
      icon?: React.ReactNode;
      variant: 'default' | 'search' | 'date' | 'filter';
    }> = [];

    if (state.searchQuery.trim()) {
      filters.push({
        id: 'search',
        label: state.searchQuery,
        onRemove: onRemoveSearch,
        icon: <Search size={12} />,
        variant: 'search',
      });
    }

    state.filters.forEach(group => {
      const options = filterOptions[group.id] || [];
      group.conditions.forEach((condition, index) => {
        const option = options.find(o => o.value === condition.value);
        filters.push({
          id: `${group.id}-${index}`,
          label: option?.label || condition.label || String(condition.value),
          onRemove: () => onRemoveFilter(group.id, index),
          icon: <Filter size={12} />,
          variant: 'filter',
        });
      });
    });

    if (state.dateRange?.from || state.dateRange?.to) {
      const fromStr = state.dateRange.from ? formatDateShort(state.dateRange.from) : '...';
      const toStr = state.dateRange.to ? formatDateShort(state.dateRange.to) : '...';
      filters.push({
        id: 'dateRange',
        label: `${fromStr} – ${toStr}`,
        onRemove: onRemoveDateRange,
        icon: <Calendar size={12} />,
        variant: 'date',
      });
    }

    return filters;
  }, [state, filterOptions, onRemoveSearch, onRemoveFilter, onRemoveDateRange]);

  if (activeFilters.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -10 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -10 }}
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      {!compact && (
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <SlidersHorizontal size={12} />
          Active Filters
        </span>
      )}
      
      <AnimatePresence mode="wait">
        {activeFilters.map(filter => (
          <FilterChip
            key={filter.id}
            label={filter.label}
            onRemove={filter.onRemove}
            icon={filter.icon}
            variant={filter.variant}
          />
        ))}
      </AnimatePresence>

      {!compact && activeFilters.length > 1 && (
        <motion.button
          type="button"
          onClick={onClearAll}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl border border-zinc-700/50 transition-colors"
        >
          Clear all
        </motion.button>
      )}
    </motion.div>
  );
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface FilterBarProps {
  state: FilterState<any>;
  onSearchChange: (query: string) => void;
  onFilterChange: (filters: FilterGroup<any>[]) => void;
  onDateRangeChange: (range: DateRange | null) => void;
  onClearAll: () => void;
  searchPlaceholder?: string;
  filterConfigs?: Array<{
    id: string;
    label: string;
    options: MultiSelectOption[];
  }>;
  dateRangeLabel?: string;
  showDateRange?: boolean;
  className?: string;
  compact?: boolean;
}

export function FilterBar({
  state,
  onSearchChange,
  onFilterChange,
  onDateRangeChange,
  onClearAll,
  searchPlaceholder = 'Search...',
  filterConfigs = [],
  dateRangeLabel = 'Date Range',
  showDateRange = true,
  className = '',
  compact = false,
}: FilterBarProps) {
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (state.searchQuery.trim()) count++;
    count += state.filters.reduce((sum, g) => sum + g.conditions.length, 0);
    if (state.dateRange?.from || state.dateRange?.to) count++;
    return count;
  }, [state.searchQuery, state.filters, state.dateRange]);

  const handleRemoveSearch = () => onSearchChange('');
  const handleRemoveFilter = (groupId: string, conditionIndex: number) => {
    const newFilters = [...state.filters];
    const group = newFilters.find(g => g.id === groupId);
    if (group) {
      group.conditions.splice(conditionIndex, 1);
      if (group.conditions.length === 0) {
        onFilterChange(newFilters.filter(g => g.id !== groupId));
      } else {
        onFilterChange(newFilters);
      }
    }
  };
  const handleRemoveDateRange = () => onDateRangeChange(null);

  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      <div className="flex-1 min-w-0">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={state.searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className={`
            w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border rounded-xl
            text-white placeholder:text-zinc-600
            focus:outline-none focus:ring-2 transition-all duration-200
            backdrop-blur-sm
            ${state.searchQuery
              ? 'border-emerald-500/50 focus:ring-emerald-500/50 bg-zinc-900/90'
              : 'border-zinc-800 focus:border-zinc-700 hover:border-zinc-700'
            }
          `}
        />
      </div>

      {!compact && filterConfigs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterConfigs.map(config => {
            const group = state.filters.find(f => f.id === config.id);
            const selectedCount = group?.conditions.length || 0;
            
            return (
              <button
                key={config.id}
                type="button"
                onClick={() => {}}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200
                  ${selectedCount > 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-950/80 text-zinc-300 border border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }
                `}
              >
                <Filter size={16} />
                <span>{config.label}</span>
                {selectedCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500 text-zinc-950">
                    {selectedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!compact && showDateRange && (
        <div className="relative">
          <button
            type="button"
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200
              ${state.dateRange?.from || state.dateRange?.to
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-zinc-950/80 text-zinc-300 border border-zinc-800 hover:border-zinc-700 hover:text-white'
              }
            `}
          >
            <Calendar size={16} />
            <span>{dateRangeLabel}</span>
            {(state.dateRange?.from || state.dateRange?.to) && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-zinc-950">
                {state.dateRange.from ? formatDateShort(state.dateRange.from) : '...'} – {state.dateRange.to ? formatDateShort(state.dateRange.to) : '...'}
              </span>
            )}
          </button>
        </div>
      )}

      <ActiveFiltersDisplay
        state={state}
        onRemoveSearch={handleRemoveSearch}
        onRemoveFilter={handleRemoveFilter}
        onRemoveDateRange={handleRemoveDateRange}
        onClearAll={onClearAll}
        filterOptions={Object.fromEntries(filterConfigs.map(c => [c.id, c.options]))}
        compact={compact}
      />
    </div>
  );
}