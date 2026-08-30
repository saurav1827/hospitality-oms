'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error('[v0] global error', error), [error])
  return <html lang="en"><body><main className="error-screen"><div className="error-card"><span className="eyebrow">Critical application error</span><h1>Tableline needs to restart.</h1><p>The error was recorded safely. Recover the application to continue operations.</p><button className="primary-button" onClick={reset}>Restart workspace</button></div></main></body></html>
}
