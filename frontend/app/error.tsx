'use client'

import { useEffect } from 'react'
import { CircleAlert, RefreshCw, LogOut } from 'lucide-react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error('[v0] route error', error), [error])
  return (
    <main className="error-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--surface-sunken)' }}>
      <div className="error-card" style={{ width: '400px', backgroundColor: 'var(--surface-default)', padding: '40px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <div className="error-symbol" style={{ marginBottom: '16px', color: 'var(--red-text)' }}><CircleAlert size={32} /></div>
        <span className="eyebrow" style={{ display: 'block', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>Something went wrong</span>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>We couldn't load the workspace.</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>Your data is safe. Try recovering the view, or sign out and back in if the problem continues.</p>
        <div className="error-actions" style={{ display: 'flex', gap: '12px' }}>
          <button className="primary-button" onClick={reset}><RefreshCw size={16} style={{ marginRight: '6px' }} /> Try again</button>
          <button className="ghost-button" onClick={() => window.location.href = '/login'}><LogOut size={16} style={{ marginRight: '6px' }} /> Sign out</button>
        </div>
      </div>
    </main>
  )
}
