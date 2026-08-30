# Overview Page Redesign - Implementation Plan

## 🎯 Vision
Transform the Overview page into a **state-of-the-art, premium dashboard** that feels robust, highly interactive, and visually stunning — suitable for a high-end hospitality operations system.

---

## 📦 New Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `recharts` | Sparkline charts for metrics cards | Latest |
| `framer-motion` | Micro-animations, enter/exit transitions, pulse effects | Latest |
| `lucide-react` | Already installed - continue using for icons | - |
| `sonner` | Already installed - for toast notifications | - |

**Install Command:**
```bash
cd frontend && pnpm add recharts framer-motion
```

---

## 🧩 Component Architecture

```
page.tsx (Dashboard Overview - Server/Client boundary)
├── OverviewHeader (Client) - Dynamic gradient header + Global Search/Command Palette
├── MetricsRow (Client) - 4 MetricCard components with Sparklines
│   └── MetricCard (Client) - Glassmorphism, hover scale, SparklineChart
│       └── SparklineChart (Client) - Recharts AreaChart, responsive
├── ContentGrid (Client) - Two-column layout
│   ├── OrdersPanel (Client) - Advanced Order Activity Table
│   │   ├── OrdersTableToolbar (Client) - Filters, Search, Refresh
│   │   ├── OrdersTable (Client) - Virtualized, animated rows
│   │   │   ├── OrderRow (Client) - Framer Motion enter animation, hover actions
│   │   │   ├── RowQuickActions (Client) - Hover menu: Print, Assign, View
│   │   │   └── SkeletonRow (Client) - Shimmer loading state
│   │   └── OrdersPagination (Client)
│   └── AttentionQueuePanel (Client) - Interactive Prioritized Timeline
│       ├── AttentionTimeline (Client) - Animated list
│       ├── AttentionCard (Client) - Pulse >10min, swipe gestures, quick actions
│       │   ├── AttentionPulse (Client) - CSS keyframe pulse
│       │   ├── SwipeActions (Client) - Touch/mouse drag to reveal actions
│       │   └── QuickAssignRunner (Client) - Inline runner assignment
│       └── AttentionEmptyState (Client) - Custom SVG illustration
├── OrderDetailModal (Existing - keep, enhance animations)
└── AllAttentionModal (Existing - keep)
```

---

## 🎨 Styling Strategy

### Design Tokens (CSS Variables / Tailwind Config)
```css
/* Glassmorphism */
--glass-bg: rgba(24, 24, 27, 0.7);           /* zinc-950/70 */
--glass-border: rgba(63, 63, 70, 0.5);       /* zinc-700/50 */
--glass-border-hover: rgba(234, 179, 8, 0.3); /* amber-500/30 */
--glass-blur: blur(20px);

/* Gradients */
--header-gradient: linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%);
--metric-gradient-1: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05));
--metric-gradient-2: linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(234, 179, 8, 0.05));
--metric-gradient-3: linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(249, 115, 22, 0.05));
--metric-gradient-4: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05));

/* Animation */
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Color Hierarchy (Typography)
| Element | Color | Weight |
|---------|-------|--------|
| Page Title | `zinc-50` / `white` | 700 |
| Section Headers | `zinc-100` | 600 |
| Body Text | `zinc-300` | 400 |
| Secondary/Muted | `zinc-500` | 400 |
| Disabled/Subtle | `zinc-600` | 400 |
| Accent (Positive) | `emerald-400` | 500 |
| Accent (Warning) | `amber-400` | 500 |
| Accent (Critical) | `red-400` | 500 |

---

## ⚡ Feature Implementation Details

### 1. Premium Metrics Row (Sparklines + Glassmorphism)

**MetricCard Component:**
- Glassmorphism: `backdrop-blur-xl bg-zinc-950/70 border border-zinc-700/50`
- Hover: `scale-[1.02] border-amber-500/30 shadow-[0_0_40px_rgba(234,179,8,0.15)]`
- Sparkline: Recharts `AreaChart` with gradient fill, no axes, responsive container
- Data: Fetch last 24h hourly aggregates (need new API endpoint or compute client-side from orders)
- Skeleton: Shimmer animation while loading

**SparklineChart Props:**
```ts
interface SparklineDataPoint { time: string; value: number }
interface SparklineChartProps {
  data: SparklineDataPoint[];
  color: 'emerald' | 'amber' | 'orange' | 'blue';
  height?: number; // default 60
}
```

### 2. Advanced Real-Time Order Activity Table

**Skeleton Loading:**
- 5-7 `SkeletonRow` components with `animate-pulse` shimmer
- Match exact column widths of real rows

**Framer Motion Row Animations:**
```tsx
// Enter animation
initial={{ opacity: 0, y: -10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3, ease: 'easeOut' }}

// New order highlight (triggered via key change or prop)
whileHover={{ scale: 1.01 }}
animate={{ backgroundColor: isNew ? 'rgba(34, 197, 94, 0.15)' : 'transparent' }}
transition={{ duration: 2000, ease: 'easeOut' }}
```

**Quick Actions Hover Menu:**
- Appears on row hover (right side)
- Actions: Print Ticket, Assign Runner, View Details, Mark Ready
- Framer Motion `AnimatePresence` for smooth enter/exit

**Global Search/Command Palette:**
- Top of OrdersPanel, sticky
- Debounced filter (150ms) on Order ID, Table/Room, Waiter
- Keyboard shortcut: `Cmd/Ctrl + K` to focus
- Command palette style dropdown with recent searches

### 3. Dynamic Attention Queue (Interactive Timeline)

**AttentionCard:**
- Prioritized by time waiting (oldest first)
- **Pulse Animation** for items > 10 minutes:
  ```css
  @keyframes attention-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  }
  .attention-urgent { animation: attention-pulse 2s infinite; }
  ```

**Swipe Gestures (Desktop + Mobile):**
- Mouse drag / Touch swipe left → Reveal "Assign Runner" + "Dismiss"
- Mouse drag / Touch swipe right → Reveal "View Order" + "Print"
- Framer Motion `drag` constraints or custom `useDrag` hook

**Quick Actions on Card:**
- Inline runner assignment dropdown (fetch runners via API)
- One-click "Assign & Notify"

### 4. Global Search & Command Palette

**Location:** Top of Overview page, above Metrics Row
**Behavior:**
- Instant client-side filtering (no API call)
- Searches: Order ID, Table/Room Number, Waiter Name, Status
- Keyboard: `Cmd/Ctrl + K` opens/focuses
- Visual: Expanding search bar with subtle glow on focus

### 5. Aesthetic & Typographic Polish

**Page Header:**
- Dynamic gradient background (CSS `@keyframes` slow shift)
- Glassmorphism card behind title
- Live clock/date with smooth transitions

**Empty States:**
- Custom SVG illustrations (not Lucide icons)
- Three variants: No Orders, No Attention Items, No Data
- Animated SVG elements (subtle float/breathe)

**Typography Scale:**
```css
.text-display { @apply text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50; }
.text-title { @apply text-xl sm:text-2xl font-semibold text-zinc-100; }
.text-body { @apply text-base text-zinc-300; }
.text-body-sm { @apply text-sm text-zinc-400; }
.text-metric { @apply text-3xl sm:text-4xl font-bold tabular-nums; }
.text-metric-label { @apply text-xs font-medium uppercase tracking-wider text-zinc-500; }
```

---

## 🔄 Data Flow & API Considerations

### Current API Endpoints (Used)
- `GET /api/properties/{id}/revenue-summary/` → RevenueSummary
- `GET /api/properties/{id}/orders/` → Order[]
- `GET /api/properties/{id}/deliveries/ready` → Delivery[]

### New Data Requirements
1. **Hourly metrics for Sparklines** (24h):
   - Option A: New endpoint `GET /api/properties/{id}/metrics/hourly`
   - Option B: Compute client-side from orders (heavy for large datasets)
   - **Recommendation:** Option A - lightweight aggregated data

2. **Runners list for quick-assign:**
   - `GET /api/properties/{id}/runners/` → Runner[]

3. **WebSocket / SSE for true real-time:**
   - Current: Polling every 10s
   - Future: Upgrade to `useRealtime` hook (already exists in codebase)

---

## 📋 Implementation Phases

### Phase 1: Foundation & Metrics Row (Day 1)
- [ ] Install `recharts`, `framer-motion`
- [ ] Create `SparklineChart` component
- [ ] Create `MetricCard` with glassmorphism + hover
- [ ] Build `MetricsRow` - fetch hourly data (mock initially)
- [ ] Add skeleton loading for metrics

### Phase 2: Orders Panel Overhaul (Day 1-2)
- [ ] Create `SkeletonRow` component
- [ ] Build `OrdersTable` with Framer Motion row animations
- [ ] Implement `RowQuickActions` hover menu
- [ ] Add Global Search/Command Palette component
- [ ] Integrate debounced filtering
- [ ] Keyboard shortcut (`Cmd+K`)

### Phase 3: Attention Queue Timeline (Day 2)
- [ ] Create `AttentionCard` with pulse animation (>10min)
- [ ] Implement swipe gestures (drag to reveal actions)
- [ ] Build inline runner assignment
- [ ] Create custom SVG empty state illustrations

### Phase 4: Header, Polish & Integration (Day 2-3)
- [ ] Build `OverviewHeader` with dynamic gradient + search
- [ ] Apply typography scale across all components
- [ ] Refine glassmorphism consistency
- [ ] Test responsive breakpoints (mobile, tablet, desktop)
- [ ] Performance audit (virtualization for large order lists)

### Phase 5: Polish & Edge Cases (Day 3)
- [ ] Error boundaries per section
- [ ] Retry mechanisms for failed fetches
- [ ] Accessibility audit (ARIA, keyboard nav, focus states)
- [ ] Dark mode verification (already dark-only)
- [ ] Cross-browser testing

---

## 🧪 Testing Strategy

| Test Type | Tool | Coverage |
|-----------|------|----------|
| Unit | Vitest + React Testing Library | Components, hooks, utils |
| Visual | Storybook | All component variants |
| E2E | Playwright | Critical user flows |
| Performance | Lighthouse / Web Vitals | FCP, LCP, CLS, TBT |

---

## 📱 Responsive Breakpoints

| Breakpoint | Layout Changes |
|------------|----------------|
| `< 640px` (mobile) | Metrics: 2x2 grid, Tables: horizontal scroll, Attention: full-width cards, Search: full-width |
| `640px - 1024px` (tablet) | Metrics: 4x1, Tables: condensed, Side-by-side panels |
| `> 1024px` (desktop) | Full layout as designed |

---

## ♿ Accessibility Checklist

- [ ] All interactive elements: focus-visible rings
- [ ] Color contrast: WCAG AA (4.5:1) minimum
- [ ] Semantic HTML: `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`
- [ ] ARIA labels for icon-only buttons
- [ ] Live regions for real-time updates (`aria-live="polite"`)
- [ ] Keyboard navigation: Tab, Enter, Escape, Arrow keys
- [ ] Screen reader announcements for new orders

---

## 🚀 Performance Budget

| Metric | Target |
|--------|--------|
| Initial JS Bundle | < 150KB gzipped |
| Metrics Row Paint | < 200ms |
| Table Render (50 rows) | < 100ms |
| Animation Frame Rate | 60fps (no jank) |
| Lighthouse Performance | > 90 |

---

## 📝 Notes & Decisions

1. **No new backend endpoints for MVP** - Compute sparkline data client-side from existing orders (last 24h, bucketed hourly). If performance suffers, add endpoint in Phase 2.

2. **Framer Motion over Tailwind animate-in** - More control for complex sequences (staggered row entrance, pulse, swipe).

3. **Recharts for Sparklines** - Lightweight, tree-shakeable, SSR-compatible. Alternative: `uCharts` or custom SVG (more work).

4. **Virtualization** - Not needed initially (max ~50 orders visible). Add `@tanstack/react-virtual` if needed.

5. **Command Palette** - Start with simple search bar. Full command palette (Cmd+K with actions) as enhancement.

---

## ✅ Approval Required

**Please review and confirm:**
1. Dependencies approved (`recharts`, `framer-motion`)?
2. Component structure acceptable?
3. Phasing timeline works?
4. Any features to add/remove?
5. Design token preferences (colors, spacing)?

Once approved, I'll begin Phase 1 implementation.