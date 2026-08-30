'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSession } from '@/lib/use-session'
import { fetchPropertyDetails, updatePropertyDetails, type Property } from '@/lib/api-client'
import { Building2, Save, Loader2, DollarSign, Percent, Globe, Sparkles } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  const { data: propData, mutate: mutateProperty, isLoading: isPropLoading } = useSWR<{ property: Property }>(
    propertyId ? `/api/properties/${propertyId}/` : null,
    () => fetchPropertyDetails(propertyId)
  )

  const property = propData?.property

  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (property) {
      setName(property.name || '')
      setCurrency(property.currency || 'INR')
    }
  }, [property])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Property name cannot be empty')
      return
    }

    setIsSaving(true)
    try {
      await updatePropertyDetails(propertyId, {
        name: name.trim(),
        currency
      })
      await mutateProperty()
      toast.success('Property settings updated successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update property settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (sessionLoading || isPropLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        <span>Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Building2 className="text-amber-500" size={24} />
          Property Settings
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your hospitality property name, currency, and tax configurations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Property / Venue Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hotel Ramayan"
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
              <p className="text-xs text-zinc-500 mt-1">
                This name is displayed on guest QR menus, receipts, and staff dashboards.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <DollarSign size={14} className="text-amber-500" /> Currency Code
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="NPR">NPR (रु)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (AED)</option>
                </select>
              </div>
            </div>



            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Card */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-amber-400" />
              Live Preview
            </h3>

            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-3">
              <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Guest QR View</div>
              <div className="border-l-2 border-amber-500 pl-3">
                <div className="font-bold text-zinc-100 text-lg">{name || 'Hotel Ramayan'}</div>
                <div className="text-xs text-zinc-400 mt-0.5">Welcome & digital dining portal</div>
              </div>
              <div className="pt-2 border-t border-zinc-900 flex justify-end text-xs text-zinc-400">
                <span>Currency: {currency}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
