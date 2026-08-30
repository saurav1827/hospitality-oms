'use client'

import { useEffect, useState, useRef } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/use-session'
import { apiFetch, type Location } from '@/lib/api-client'
import { toast } from 'sonner'
import { QRCodeCanvas as QRCode } from 'qrcode.react'

import {
  Loader2,
  QrCode,
  Link as LinkIcon,
  Download,
  Check,
  MapPin,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Sparkles
} from 'lucide-react'

// Extended type to safely include qr_token
type LocationWithToken = Location & { qrToken?: string; qr_token?: string }

export default function QRGeneratorPage() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  const [selectedLocation, setSelectedLocation] = useState<LocationWithToken | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // AI Poster state
  const [isAIGenerating, setIsAIGenerating] = useState(false)
  const [aiGeneratedImage, setAiGeneratedImage] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  const { data: propertyData } = useSWR<{ property: { name: string } }>(
    propertyId ? `/api/properties/${propertyId}/` : null,
    apiFetch
  )
  const propertyName = propertyData?.property?.name || 'Our Hotel'

  const { data: locationsData, isLoading: locLoading } = useSWR<{ locations: LocationWithToken[] }>(
    propertyId ? `/api/properties/${propertyId}/locations/` : null,
    apiFetch,
    { onError: (err) => toast.error(err.message || 'Failed to load locations') }
  )

  const locations = locationsData?.locations ?? []

  if (sessionLoading) {
    return (
      <div className="flex w-full h-[60vh] items-center justify-center text-emerald-500">
        <Loader2 size={32} className="animate-spin" />
      </div>
    )
  }

  if (!session) return null

  const getToken = (loc: LocationWithToken) => loc.qrToken || loc.qr_token || ''

  const getAppUrl = (token: string) => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/guest/${token}`
  }

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(getAppUrl(token))
    setIsCopied(true)
    toast.success('Link copied to clipboard!')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleGeneratePoster = async (format: 'pdf' | 'png') => {
    if (!selectedLocation) return
    setIsGenerating(true)
    const toastId = toast.loading(`Generating Poster ${format.toUpperCase()}...`)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const downloadUrl = `${apiUrl}/api/properties/${propertyId}/locations/${selectedLocation.id}/poster/?format=${format}`

      const response = await fetch(downloadUrl, {
        credentials: 'include',
        // If your API client (apiFetch) attaches an Authorization header for
        // authenticated requests, add the same header here.
      })

      if (!response.ok) {
        let message = 'Failed to generate poster. Please try again.'
        try {
          const body = await response.json()
          if (body?.error) message = body.error
        } catch {
          // Response wasn't JSON — fall back to the generic message.
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `Poster-${selectedLocation.label.replace(/\s+/g, '-')}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(blobUrl)

      toast.success(`Poster ${format.toUpperCase()} downloaded successfully!`, { id: toastId })
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Failed to generate poster. Please try again.'
      toast.error(message, { id: toastId })
    } finally {
      setIsGenerating(false)
    }
  }

  // Fallback to just download the raw QR code
  const handleDownloadQR = async (loc: LocationWithToken) => {
    const token = getToken(loc)
    if (!token) return

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=${encodeURIComponent(getAppUrl(token))}&margin=20`
    const toastId = toast.loading('Downloading QR code...')

    try {
      const response = await fetch(qrUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `QR-${loc.label.replace(/\s+/g, '-')}.png`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('QR Code downloaded', { id: toastId })
    } catch (error) {
      toast.error('Failed to download QR code', { id: toastId })
    }
  }

  const compositeAIPoster = (bgDataUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const qrCanvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
      const qrDataUrl = qrCanvas ? qrCanvas.toDataURL('image/png') : null;

      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is not supported in this browser.'));
        return;
      }

      const bgImg = new Image();
      bgImg.crossOrigin = "Anonymous";
      bgImg.onerror = () => reject(new Error('Could not load the generated background image.'));
      bgImg.onload = () => {
        // Draw AI background
        ctx.drawImage(bgImg, 0, 0, 1024, 1024);

        // Add a dark overlay/card in the center for the QR code
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(1024 / 2 - 250, 1024 / 2 - 320, 500, 640, 40);
        } else {
          ctx.rect(1024 / 2 - 250, 1024 / 2 - 320, 500, 640);
        }
        ctx.fill();

        // Add Text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(selectedLocation?.label || 'Order Here', 1024 / 2, 1024 / 2 - 210);

        ctx.font = '24px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('Scan to order from your table', 1024 / 2, 1024 / 2 - 160);

        // Draw QR Code
        if (qrDataUrl) {
          const qrImg = new Image();
          qrImg.onerror = () => reject(new Error('Could not render the QR code onto the poster.'));
          qrImg.onload = () => {
            // Add white background for QR code
            ctx.fillStyle = 'white';
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(1024 / 2 - 144, 1024 / 2 - 116, 288, 288, 24);
              ctx.fill();
            } else {
              ctx.fillRect(1024 / 2 - 144, 1024 / 2 - 116, 288, 288);
            }

            ctx.drawImage(qrImg, 1024 / 2 - 128, 1024 / 2 - 100, 256, 256);

            // Final composite data URL
            setAiGeneratedImage(canvas.toDataURL('image/png'));
            resolve();
          };
          qrImg.src = qrDataUrl;
        } else {
          setAiGeneratedImage(canvas.toDataURL('image/png'));
          resolve();
        }
      };
      bgImg.src = bgDataUrl;
    });
  }

  const handleGenerateAIPoster = async () => {
    if (!selectedLocation) return

    setIsAIGenerating(true)
    const toastId = toast.loading('Generating your AI poster background...')

    try {
      const response = await fetch('/api/generate-poster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationName: selectedLocation.label,
          propertyName: propertyName
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate image from local API')
      }

      const data = await response.json()
      if (data.b64_json) {
        const b64 = `data:image/png;base64,${data.b64_json}`
        toast.loading('Background ready — compositing poster...', { id: toastId })
        await compositeAIPoster(b64)
        toast.success('AI poster generated!', { id: toastId })
      } else {
        throw new Error(data.error || 'Invalid response from API')
      }
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Failed to generate AI poster. Please try a different prompt.'
      toast.error(message, { id: toastId })
    } finally {
      setIsAIGenerating(false)
    }
  }

  const selectedToken = selectedLocation ? getToken(selectedLocation) : ''

  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-xs font-bold tracking-widest uppercase">
            <QrCode size={14} />
            <span>Ordering Access</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            QR Studio
          </h2>
          <p className="text-zinc-400 max-w-2xl text-lg">
            Design breathtaking, AI-powered table-top posters using <strong className="text-white">NVIDIA NIM</strong> generative models.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">

        {/* Left Column: Locations List */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none" />

          <div className="p-6 border-b border-white/10 relative z-10 flex items-center justify-between">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <MapPin size={20} className="text-orange-400" /> Locations
            </h3>
            <span className="bg-orange-500/20 text-orange-300 text-xs px-3 py-1 rounded-full font-bold border border-orange-500/20">
              {locations.length} Total
            </span>
          </div>

          <div className="p-4 overflow-y-auto max-h-[600px] space-y-3 custom-scrollbar relative z-10">
            {locLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 w-full bg-zinc-800/40 rounded-2xl animate-pulse border border-white/5" />
              ))
            ) : locations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-center px-4">
                <MapPin size={40} className="opacity-20 mb-4" />
                <p className="text-sm font-medium">No locations configured yet.</p>
              </div>
            ) : (
              locations.map((loc) => {
                const isSelected = selectedLocation?.id === loc.id
                return (
                  <button
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocation(loc)
                      setAiGeneratedImage(null)
                    }}
                    className={`group w-full flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 ${isSelected
                      ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/10 border-orange-500/50 text-white shadow-[0_0_30px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/20'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10 text-zinc-300'
                      }`}
                  >
                    <div className="text-left flex flex-col gap-1">
                      <span className={`font-bold text-base transition-colors ${isSelected ? 'text-white' : 'text-zinc-200 group-hover:text-white'}`}>
                        {loc.label}
                      </span>
                      <span className={`text-xs capitalize font-medium flex items-center gap-1 ${isSelected ? 'text-orange-300' : 'text-zinc-500'}`}>
                        {loc.kind} Area
                      </span>
                    </div>
                    <ChevronRight
                      size={20}
                      className={`transition-all duration-300 ${isSelected ? 'text-orange-400 translate-x-1' : 'text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5'}`}
                    />
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Preview & Actions */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col">
          {selectedLocation ? (
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 lg:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden h-full flex flex-col">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" />

              <div className="relative z-10 w-full mb-8 pb-6 border-b border-white/10 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
                <div>
                  <h3 className="text-3xl font-bold text-white tracking-tight mb-2">{selectedLocation.label}</h3>
                  <p className="text-zinc-400">Design a premium ordering poster or share the direct link.</p>
                </div>
              </div>

              {selectedToken ? (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1">

                  {/* Left Panel: Standard QR & Details */}
                  <div className="xl:col-span-5 space-y-6 flex flex-col">
                    <div className="p-8 bg-black/40 border border-white/10 rounded-[2rem] flex flex-col items-center justify-center flex-1 shadow-inner relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50" />

                      <div className="bg-white p-3 rounded-[2.5rem] shadow-2xl ring-4 ring-white/10 transform transition-transform hover:scale-[1.03] duration-500 mb-8 relative z-10">
                        <div className="border-[3px] border-dashed border-zinc-200 rounded-[2rem] p-6 bg-white relative flex items-center justify-center">
                          <QRCode
                            id="qr-canvas"
                            value={getAppUrl(selectedToken)}
                            size={220}
                            level="H"
                            includeMargin={true}
                            bgColor="#ffffff"
                            fgColor="#09090b"
                            className="w-52 h-52 mx-auto"
                          />
                        </div>
                      </div>

                      <div className="w-full relative z-10 space-y-4">
                        <div className="group flex items-center bg-zinc-900/80 border border-white/10 rounded-2xl p-2 backdrop-blur-md transition-all hover:border-white/20 hover:shadow-lg">
                          <div className="flex items-center gap-3 px-4 py-2 text-zinc-400 overflow-hidden flex-1">
                            <LinkIcon size={18} className="shrink-0 text-zinc-500" />
                            <span className="text-sm font-medium truncate select-all">{getAppUrl(selectedToken)}</span>
                          </div>
                          <button
                            onClick={() => handleCopy(selectedToken)}
                            className="shrink-0 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                          >
                            {isCopied ? <Check size={16} className="text-emerald-400" /> : 'Copy'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <button
                            onClick={() => handleGeneratePoster('pdf')}
                            disabled={isGenerating}
                            className="flex items-center justify-center gap-2 px-4 py-4 bg-white hover:bg-zinc-200 disabled:bg-zinc-500 text-black font-bold rounded-2xl transition-all shadow-lg shadow-white/5"
                          >
                            {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                            Standard PDF Poster
                          </button>
                          <button
                            onClick={() => handleDownloadQR(selectedLocation)}
                            className="flex items-center justify-center gap-2 px-4 py-4 bg-zinc-800/80 hover:bg-zinc-700 text-white font-medium rounded-2xl transition-all border border-white/10 hover:border-white/20"
                          >
                            <Download size={20} /> Download QR Only
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Panel: AI Poster Studio */}
                  <div className="xl:col-span-7 flex flex-col h-full bg-gradient-to-b from-orange-500/[0.08] to-amber-500/[0.02] border border-orange-500/20 rounded-[2.5rem] p-8 relative overflow-hidden shadow-[0_0_50px_rgba(249,115,22,0.05)]">
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

                    <div className="flex items-center justify-between mb-8 relative z-10">
                      <div>
                        <h4 className="text-2xl font-extrabold text-white flex items-center gap-3">
                          <Sparkles className="text-orange-400" size={24} /> AI Studio
                        </h4>
                        <p className="text-sm text-zinc-400 mt-1 font-medium">Text-to-image poster generation.</p>
                      </div>
                      <div className="px-4 py-1.5 bg-zinc-950/50 border border-white/10 rounded-full text-zinc-300 text-xs font-bold tracking-widest backdrop-blur-md flex items-center gap-2 shadow-inner">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        NVIDIA NIM
                      </div>
                    </div>

                    <div className="space-y-6 relative z-10 flex-1 flex flex-col">
                      {!aiGeneratedImage ? (
                        <>
                          <div className="flex-1 flex flex-col justify-center text-center px-6">
                            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(249,115,22,0.4)]">
                              <Sparkles size={40} className="text-white" />
                            </div>
                            <h5 className="text-2xl font-bold text-white mb-3">Auto-Magic Poster</h5>
                            <p className="text-zinc-400 text-sm">
                              Click below to instantly generate a breathtaking, highly-stylized poster background tailored perfectly for <strong className="text-white">{propertyName}</strong> and <strong className="text-white">{selectedLocation.label}</strong>.
                            </p>
                          </div>

                          <button
                            onClick={handleGenerateAIPoster}
                            disabled={isAIGenerating}
                            className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-black font-extrabold rounded-[1.5rem] transition-all shadow-[0_0_30px_rgba(249,115,22,0.25)] hover:shadow-[0_0_40px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 text-lg"
                          >
                            {isAIGenerating ? (
                              <>
                                <Loader2 size={24} className="animate-spin" />
                                Generating Masterpiece...
                              </>
                            ) : (
                              <>
                                <Sparkles size={24} />
                                Generate AI Poster
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        <div className="animate-in fade-in zoom-in-95 duration-700 flex-1 flex flex-col gap-6">
                          <div className="flex-1 rounded-[2rem] overflow-hidden border border-white/10 relative group bg-black shadow-2xl flex items-center justify-center mx-auto w-full max-w-[400px]">
                            <img src={aiGeneratedImage} alt="AI Generated Poster" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col gap-4 items-center justify-center backdrop-blur-md">
                              <button
                                onClick={() => setAiGeneratedImage(null)}
                                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-sm font-bold transition-all hover:scale-105"
                              >
                                Edit Prompt
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const a = document.createElement('a')
                              a.href = aiGeneratedImage
                              a.download = `AI-Poster-${selectedLocation.label.replace(/\s+/g, '-')}.png`
                              a.click()
                            }}
                            className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-[1.5rem] transition-all shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 text-lg"
                          >
                            <Download size={24} /> Download High-Res Poster
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-8 rounded-3xl flex items-center gap-4 flex-1">
                  <div className="p-4 bg-red-500/20 rounded-full">
                    <QrCode size={32} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Missing QR Token</p>
                    <p className="opacity-80 font-medium">This location has not been assigned a valid ordering token. Please check configuration.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full bg-zinc-900/30 border border-white/5 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-zinc-500 text-center p-12 transition-all backdrop-blur-md min-h-[500px]">
              <div className="bg-white/5 p-8 rounded-full border border-white/10 mb-8 shadow-inner">
                <QrCode size={56} className="text-zinc-600" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-300 mb-3">No Location Selected</h3>
              <p className="max-w-md text-base">Select a location from the sidebar to view, download, or generate AI posters for its QR code.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}