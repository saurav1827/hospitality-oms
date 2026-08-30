import { AlertCircle } from 'lucide-react'
import GuestClient from './GuestClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function getGuestData(qrToken: string) {
  try {
    // Next.js Server Components run on Node 18+, which prioritizes IPv6 (::1).
    // Django dev server binds to IPv4 (127.0.0.1) by default, causing ECONNREFUSED.
    const serverApiUrl = API_URL.replace('localhost', '127.0.0.1')
    const url = `${serverApiUrl}/api/guest/${qrToken}/`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.error(`getGuestData fetch failed: ${res.status} ${res.statusText}`)
      const errorText = await res.text()
      console.error(`Response body: ${errorText}`)
      return { error: 'Invalid or expired QR code.' }
    }
    return await res.json()
  } catch (error) {
    console.error(`getGuestData network/fetch error:`, error)
    return { error: 'Failed to connect to the server.' }
  }
}

export default async function GuestOrderPage({ params }: { params: Promise<{ qrToken: string }> | { qrToken: string } }) {
  // Support both Next.js 14 and 15+ by resolving params if it's a promise
  const resolvedParams = await Promise.resolve(params)
  const qrToken = resolvedParams.qrToken

  const data = await getGuestData(qrToken)

  if (data.error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={64} className="text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
        <h1 className="text-3xl font-extrabold text-white mb-3">Invalid or Expired QR Code</h1>
        <p className="text-zinc-400 text-lg">Please scan a valid QR code at your table or room.</p>
      </div>
    )
  }

  return <GuestClient qrToken={qrToken} initialData={data} />
}
