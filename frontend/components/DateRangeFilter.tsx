'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, CalendarDays, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DateRange } from '@/lib/filters';

interface DateRangeFilterProps {
  label?: string;
  value: DateRange;
  onChange: (range: DateRange | null) => void;
  placeholder?: { from: string; to: string };
  minDate?: Date;
  maxDate?: Date;
  presets?: Array<{ label: string; range: DateRange }>;
  className?: string;
  disabled?: boolean;
}

const PRESET_RANGES = [
  { label: 'Today', range: { from: new Date(new Date().setHours(0,0,0,0)), to: new Date() } },
  { label: 'Yesterday', range: { 
    from: new Date(new Date(Date.now() - 86400000).setHours(0,0,0,0)), 
    to: new Date(new Date(Date.now() - 86400000).setHours(23,59,59,999)) 
  }},
  { label: 'Last 7 days', range: { 
    from: new Date(Date.now() - 7 * 86400000), 
    to: new Date() 
  }},
  { label: 'Last 30 days', range: { 
    from: new Date(Date.now() - 30 * 86400000), 
    to: new Date() 
  }},
  { label: 'This month', range: { 
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), 
    to: new Date() 
  }},
  { label: 'Last month', range: { 
    from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), 
    to: new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59, 999) 
  }},
];

function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateInput(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

function areDatesEqual(a: Date | null, b: Date | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function getDaysInMonth(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const days: Date[] = [];
  
  for (let i = 0; i < startDay; i++) {
    days.push(new Date(year, month, -startDay + i + 1));
  }
  
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  
  return days;
}

export function DateRangeFilter({
  label = 'Date Range',
  value,
  onChange,
  placeholder = { from: 'From', to: 'To' },
  minDate,
  maxDate,
  presets = PRESET_RANGES,
  className = '',
  disabled = false,
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { from, to } = value || { from: null, to: null };
  const hasSelection = from || to;

  const handleDateClick = (date: Date) => {
    if (minDate && date < minDate) return;
    if (maxDate && date > maxDate) return;

    if (!from || (from && to)) {
      onChange({ from: date, to: null });
    } else if (from && !to) {
      if (date < from) {
        onChange({ from: date, to: from });
      } else {
        onChange({ from, to: date });
      }
    }
  };

  const handlePresetClick = (presetRange: DateRange) => {
    onChange(presetRange);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        setIsOpen(!isOpen);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isInRange = (date: Date) => {
    if (!from) return false;
    if (!to) return areDatesEqual(date, from);
    return date >= from && date <= to;
  };

  const isRangeStart = (date: Date) => from && areDatesEqual(date, from);
  const isRangeEnd = (date: Date) => to && areDatesEqual(date, to);
  const isRangeMiddle = (date: Date) => from && to && date > from && date < to;

  const isDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const renderCalendar = (month: Date) => {
    const days = getDaysInMonth(month);
    const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <div className="p-3" key={month.toISOString()}>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(month, -1))}
            className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-medium text-zinc-100">{monthName}</span>
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(month, 1))}
            className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-zinc-500 font-medium py-1">{day}</div>
          ))}
          
          {days.map((day, index) => {
            const isCurrentMonth = day.getMonth() === month.getMonth();
            const disabled = isDisabled(day) || !isCurrentMonth;
            const inRange = isInRange(day);
            const start = isRangeStart(day);
            const end = isRangeEnd(day);
            const middle = isRangeMiddle(day);

            return (
              <motion.button
                key={`${day.toISOString()}-${index}`}
                type="button"
                onClick={() => !disabled && handleDateClick(day)}
                onMouseEnter={() => setHoveredDate(day)}
                onMouseLeave={() => setHoveredDate(null)}
                disabled={disabled}
                className={`
                  relative h-8 w-full rounded-lg font-medium transition-all duration-150
                  ${disabled 
                    ? 'text-zinc-700 cursor-not-allowed' 
                    : inRange
                      ? start || end
                        ? 'bg-emerald-500 text-zinc-950 font-semibold'
                        : 'bg-emerald-500/20 text-emerald-400'
                      : hoveredDate && from && hoveredDate >= from && (!to || hoveredDate <= to) && day >= from && (!to || day <= hoveredDate)
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }
                  ${start && 'rounded-l-full'}
                  ${end && 'rounded-r-full'}
                `}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.01 }}
              >
                {day.getDate()}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  };

  const displayText = hasSelection
    ? `${formatDate(from)} ${to ? `– ${formatDate(to)}` : ''}`
    : placeholder.from;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${label} filter${hasSelection ? `, ${displayText}` : ''}`}
        className={`
          w-full flex items-center justify-between gap-3 px-4 py-2.5
          bg-zinc-950/80 backdrop-blur-sm border rounded-xl
          text-left transition-all duration-200
          ${disabled 
            ? 'opacity-50 cursor-not-allowed border-zinc-800' 
            : isOpen
              ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)] bg-zinc-900/90'
              : 'border-zinc-800 hover:border-zinc-700'
          }
        `}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CalendarDays size={16} className="text-zinc-500 flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            {hasSelection ? (
              <>
                <span className="font-medium text-zinc-100 truncate">{formatDate(from)}</span>
                {to && (
                  <>
                    <span className="text-zinc-500">–</span>
                    <span className="font-medium text-zinc-100 truncate">{formatDate(to)}</span>
                  </>
                )}
              </>
            ) : (
              <span className="text-zinc-500">{placeholder.from}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasSelection && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Clear date range"
            >
              <X size={14} />
            </button>
          )}
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 150 }}
            className="text-zinc-500 flex-shrink-0"
          >
            <ChevronDown size={16} />
          </motion.span>
        </div>
      </button>

      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute top-full left-0 mt-1.5 z-50 w-80"
          >
            <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 rounded-xl shadow-2xl overflow-hidden">
              <div className="p-3 border-b border-zinc-800/50 flex items-center gap-2">
                <Calendar size={16} className="text-zinc-500" />
                <span className="text-sm font-semibold text-zinc-100">{label}</span>
              </div>

              {presets.length > 0 && (
                <div className="p-3 border-b border-zinc-800/50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Quick Select</p>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handlePresetClick(preset.range)}
                        className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors border border-zinc-700/50"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 border-b border-zinc-800/50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">From</label>
                    <input
                      type="date"
                      value={formatDateInput(from)}
                      onChange={e => handleDateClick(new Date(e.target.value))}
                      min={minDate ? formatDateInput(minDate) : undefined}
                      max={maxDate ? formatDateInput(maxDate) : undefined}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">To</label>
                    <input
                      type="date"
                      value={formatDateInput(to)}
                      onChange={e => handleDateClick(new Date(e.target.value))}
                      min={minDate ? formatDateInput(minDate) : undefined}
                      max={maxDate ? formatDateInput(maxDate) : undefined}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {renderCalendar(viewMonth)}
                  {renderCalendar(addMonths(viewMonth, 1))}
                </div>
              </div>

              <div className="p-3 border-t border-zinc-800/50 bg-zinc-950/50 flex gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 py-2 text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2 text-sm font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}