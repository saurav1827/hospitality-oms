'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, ChevronUp, Search, X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MultiSelectOption } from '@/lib/filters';

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  maxDisplay?: number;
  className?: string;
  disabled?: boolean;
  showCount?: boolean;
}

const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  zinc: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...',
  searchable = true,
  maxDisplay = 3,
  className = '',
  disabled = false,
  showCount = true,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleOption = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        break;
      case 'ArrowUp':
        e.preventDefault();
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

  const displayValues = selectedValues.slice(0, maxDisplay);
  const remainingCount = selectedValues.length - maxDisplay;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${label} filter, ${selectedValues.length} selected`}
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
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </span>
          
          <AnimatePresence mode="wait">
            {selectedValues.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-wrap gap-1.5"
              >
                {displayValues.map((value, index) => {
                  const option = options.find(o => o.value === value);
                  const colorClass = option?.color ? COLOR_CLASSES[option.color] : COLOR_CLASSES.zinc;
                  
                  return (
                    <motion.span
                      key={value}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: index * 0.05 }}
                      className={`
                        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
                        border ${colorClass}
                      `}
                    >
                      {option?.label || value}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          toggleOption(value);
                        }}
                        className="p-0.5 hover:bg-white/10 rounded-full transition-colors"
                        aria-label={`Remove ${option?.label || value}`}
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  );
                })}
                
                {remainingCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium text-zinc-500 bg-zinc-800 rounded-full">
                    +{remainingCount}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {selectedValues.length === 0 && (
            <span className="text-zinc-500">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onChange([]);
              }}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Clear all selections"
            >
              <X size={14} />
            </button>
          )}
          
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 150 }}
            className="text-zinc-500 flex-shrink-0"
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
            className="absolute top-full left-0 right-0 mt-1.5 z-50"
          >
            <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 rounded-xl shadow-2xl overflow-hidden max-h-80">
              <div className="p-3 border-b border-zinc-800/50 flex items-center gap-2">
                <Filter size={16} className="text-zinc-500" />
                <span className="text-sm font-semibold text-zinc-100">{label}</span>
                <span className="px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 rounded-full">
                  {selectedValues.length} selected
                </span>
              </div>

              {searchable && (
                <div className="p-3 border-b border-zinc-800/50">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Filter options..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                {filteredOptions.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500">
                    <Search size={24} className="mx-auto mb-2 opacity-30" />
                    <p>No options match "{searchQuery}"</p>
                  </div>
                ) : (
                  filteredOptions.map(option => {
                    const isSelected = selectedValues.includes(option.value);
                    const colorClass = option.color ? COLOR_CLASSES[option.color] : COLOR_CLASSES.zinc;
                    
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        onClick={() => toggleOption(option.value)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                          ${isSelected ? 'bg-emerald-500/10' : 'hover:bg-zinc-800/50'}
                        `}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 150 }}
                      >
                        <div className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                          ${isSelected 
                            ? `bg-emerald-500 border-emerald-500` 
                            : `border-zinc-700 hover:border-zinc-600`
                          }
                        `}>
                          {isSelected && <Check size={12} className="text-zinc-950" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-100 truncate">{option.label}</span>
                            {option.color && (
                              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${colorClass}`}>
                                {option.color}
                              </span>
                            )}
                          </div>
                          {showCount && option.count !== undefined && (
                            <div className="text-xs text-zinc-500">{option.count} orders</div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>

              <div className="p-3 border-t border-zinc-800/50 flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="flex-1 py-2 text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2 text-sm font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FilterTriggerProps {
  label: string;
  count: number;
  onClick: () => void;
  isActive?: boolean;
  className?: string;
}

export function FilterTrigger({
  label,
  count,
  onClick,
  isActive = false,
  className = '',
}: FilterTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200
        ${isActive
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
          : 'bg-zinc-950/80 text-zinc-300 border border-zinc-800 hover:border-zinc-700 hover:text-white'
        }
        ${className}
      `}
    >
      <Filter size={16} />
      <span>{label}</span>
      {count > 0 && (
        <span className={`
          px-2 py-0.5 text-xs font-bold rounded-full
          ${isActive 
            ? 'bg-emerald-500 text-zinc-950' 
            : 'bg-zinc-800 text-zinc-400'
          }
        `}>
          {count}
        </span>
      )}
    </button>
  );
}