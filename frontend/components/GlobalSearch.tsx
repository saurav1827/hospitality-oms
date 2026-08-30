'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Command, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  icon?: React.ReactNode;
  action?: () => void;
  badge?: string;
}

interface GlobalSearchProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onResultSelect?: (result: SearchResult) => void;
  getResults?: (query: string) => SearchResult[] | Promise<SearchResult[]>;
  shortcutKey?: 'k' | 'slash';
  className?: string;
  disabled?: boolean;
}

export function GlobalSearch({
  placeholder = 'Search orders, tables, waiters...',
  onSearch,
  onResultSelect,
  getResults,
  shortcutKey = 'k',
  className = '',
  disabled = false,
}: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      
      const isShortcut = shortcutKey === 'k' 
        ? (e.metaKey || e.ctrlKey) && e.key === 'k'
        : e.key === '/';
      
      if (isShortcut && !isOpen && e.target instanceof HTMLInputElement === false) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }

      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        onSearch('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, disabled, shortcutKey, onSearch]);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  const handleQueryChange = useCallback(async (value: string) => {
    setQuery(value);
    onSearch(value);
    setSelectedIndex(0);

    if (getResults && value.trim()) {
      setIsLoading(true);
      try {
        const searchResults = await getResults(value);
        setResults(searchResults);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    } else {
      setResults([]);
    }
  }, [onSearch, getResults]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex] && onResultSelect) {
          onResultSelect(results[selectedIndex]);
          setIsOpen(false);
          setQuery('');
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setQuery('');
        onSearch('');
        break;
    }
  }, [results, selectedIndex, onResultSelect, onSearch]);

  const handleResultClick = useCallback((result: SearchResult) => {
    if (onResultSelect) onResultSelect(result);
    setIsOpen(false);
    setQuery('');
  }, [onResultSelect]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setTimeout(() => setIsOpen(false), 150);
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative"
      >
        <div className="relative">
          <Search 
            className={`absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors ${
              isOpen ? 'text-emerald-400' : ''
            }`} 
            size={18} 
          />
          
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            onBlur={handleBlur}
            disabled={disabled}
            className={`
              w-full pl-11 pr-12 py-3 bg-zinc-950/80 border rounded-xl
              text-white placeholder:text-zinc-600
              focus:outline-none focus:ring-2 transition-all duration-200
              backdrop-blur-sm
              ${isOpen 
                ? 'border-emerald-500/50 focus:ring-emerald-500/50 bg-zinc-900/90 shadow-[0_0_40px_rgba(234,179,8,0.1)]' 
                : 'border-zinc-800 focus:border-zinc-700 hover:border-zinc-700'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            autoComplete="off"
            spellCheck={false}
          />

          <AnimatePresence mode="wait">
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => handleQueryChange('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X size={16} />
              </motion.button>
            )}
          </AnimatePresence>

          <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-zinc-600 opacity-60">
            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 border border-zinc-700">
              {shortcutKey === 'k' ? '⌘' : ''}K
            </kbd>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isOpen && (query || results.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute top-full left-0 right-0 mt-2 z-50"
              ref={resultsRef}
            >
              <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 rounded-xl shadow-2xl overflow-hidden">
                {(results.length > 0 || isLoading) && (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {isLoading && (
                      <div className="flex items-center justify-center p-6">
                        <Loader2 size={20} className="animate-spin text-emerald-400" />
                        <span className="ml-2 text-zinc-400">Searching...</span>
                      </div>
                    )}
                    
                    {results.map((result, index) => (
                      <motion.button
                        key={result.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => handleResultClick(result)}
                        className={`
                          w-full flex items-center gap-3 p-3 px-4 transition-colors
                          ${index === selectedIndex 
                            ? 'bg-emerald-500/10 border-l-2 border-emerald-500' 
                            : 'hover:bg-zinc-800/50'
                          }
                        `}
                      >
                        {result.icon && (
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-400">
                            {result.icon}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-100 truncate">{result.title}</span>
                            {result.badge && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 rounded">
                                {result.badge}
                              </span>
                            )}
                          </div>
                          {result.subtitle && (
                            <div className="text-xs text-zinc-500 truncate">{result.subtitle}</div>
                          )}
                        </div>
                        <div className="text-xs text-zinc-600 uppercase tracking-wider font-medium">
                          {result.category}
                        </div>
                      </motion.button>
                    ))}

                    {results.length === 0 && !isLoading && (
                      <div className="p-6 text-center text-zinc-500">
                        <Search size={24} className="mx-auto mb-2 opacity-30" />
                        <p>No results found for "{query}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

interface CommandPaletteItem {
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
  icon?: React.ReactNode;
  isAction?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  getResults?: (query: string) => SearchResult[] | Promise<SearchResult[]>;
  onResultSelect?: (result: SearchResult) => void;
  sections?: Array<{
    title: string;
    items: CommandPaletteItem[];
  }>;
  className?: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSearch,
  getResults,
  onResultSelect,
  sections = [],
  className = '',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleQueryChange = useCallback(async (value: string) => {
    setQuery(value);
    onSearch(value);
    setSelectedIndex(0);

    if (getResults && value.trim()) {
      setIsLoading(true);
      try {
        const searchResults = await getResults(value);
        setResults(searchResults);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    } else {
      setResults([]);
    }
  }, [onSearch, getResults]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const actionItems = sections.flatMap(s => s.items.map((item, i) => ({
      ...item,
      __section: s.title,
      __index: i,
      isAction: true as const,
    })));
    const allItems = [...results, ...actionItems];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        const selected = allItems[selectedIndex];
        if (selected && 'isAction' in selected && selected.isAction) {
          selected.action();
          onClose();
        } else if (selected && onResultSelect) {
          onResultSelect(selected as SearchResult);
          onClose();
        }
        break;
    }
  }, [results, sections, selectedIndex, onResultSelect, onClose]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative p-4 border-b border-zinc-800/50">
          <div className="relative">
            <Command size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search..."
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-11 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {(results.length > 0 || isLoading) && (
            <div className="p-2">
              {isLoading && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 size={20} className="animate-spin text-emerald-400" />
                  <span className="ml-2 text-zinc-400">Searching...</span>
                </div>
              )}
              
              {results.map((result, index) => (
                <motion.button
                  key={result.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    if (onResultSelect) onResultSelect(result);
                    onClose();
                  }}
                  className={`
                    w-full flex items-center gap-3 p-3 px-4 transition-colors rounded-xl
                    ${index === selectedIndex 
                      ? 'bg-emerald-500/10 border-l-2 border-emerald-500' 
                      : 'hover:bg-zinc-800/50'
                    }
                  `}
                >
                  {result.icon && (
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-400">
                      {result.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100 truncate">{result.title}</span>
                      {result.badge && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 rounded">
                          {result.badge}
                        </span>
                      )}
                    </div>
                    {result.subtitle && (
                      <div className="text-xs text-zinc-500 truncate">{result.subtitle}</div>
                    )}
                  </div>
                  <div className="text-xs text-zinc-600 uppercase tracking-wider font-medium">
                    {result.category}
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {sections.map((section, sectionIndex) => (
            <div key={section.title} className="p-4 border-t border-zinc-800/50">
              <h4 className="px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                {section.title}
              </h4>
              {section.items.map((item, itemIndex) => {
                const globalIndex = results.length + sectionIndex * 1000 + itemIndex;
                const isSelected = selectedIndex === globalIndex;
                
                return (
                  <motion.button
                    key={`${section.title}-${itemIndex}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    className={`
                      w-full flex items-center gap-3 p-3 px-2 transition-colors rounded-xl
                      ${isSelected 
                        ? 'bg-emerald-500/10 border-l-2 border-emerald-500' 
                        : 'hover:bg-zinc-800/50'
                      }
                    `}
                  >
                    {item.icon && (
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-400">
                        {item.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <span className="font-medium text-zinc-100">{item.label}</span>
                      {item.description && (
                        <div className="text-xs text-zinc-500">{item.description}</div>
                      )}
                    </div>
                    {item.shortcut && (
                      <kbd className="px-2 py-0.5 text-xs text-zinc-500 bg-zinc-800 rounded font-mono">
                        {item.shortcut}
                      </kbd>
                    )}
                  </motion.button>
                );
              })}
            </div>
          ))}

          {(results.length === 0 && !isLoading && sections.length === 0) && (
            <div className="p-8 text-center text-zinc-500">
              <Command size={32} className="mx-auto mb-3 opacity-30" />
              <p>No commands or results found</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-zinc-800/50 bg-zinc-950/50 flex items-center justify-between text-xs text-zinc-500">
          <span>⌘K to open • Esc to close</span>
          <span>↑↓ to navigate • Enter to select</span>
        </div>
      </motion.div>

      <div 
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" 
        onClick={onClose}
        aria-hidden="true"
      />
    </motion.div>
  );
}