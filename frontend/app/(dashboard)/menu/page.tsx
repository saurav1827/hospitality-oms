'use client'

import { useEffect, useState, useMemo } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/use-session'
import { toast } from 'sonner'
import {
  apiFetch, type MenuItem, type Location,
  createMenuItem, updateMenuItem, deleteMenuItem, uploadImage, createLocation
} from '@/lib/api-client'
import { 
  RefreshCw, Plus, Trash2, Utensils, MapPin, Loader2, IndianRupee, 
  Store, PlusCircle, Image as ImageIcon, Search, Filter, Flame, Clock, Tag, Percent,
  Edit2
} from 'lucide-react'

export default function MenuPage() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  const isManagerOrAdmin = ['admin', 'manager'].includes(session?.role || '')

  const { data: menuData, mutate: mutateMenu, isLoading: menuLoading } = useSWR<{ menu: MenuItem[] }>(
    propertyId ? `/api/properties/${propertyId}/menu/` : null,
    apiFetch,
    { onError: (err) => toast.error(err.message || 'Failed to load menu') }
  )
  const menuItems = menuData?.menu ?? []

  const { data: locationsData, isLoading: locLoading, mutate: mutateLocations } = useSWR<{ locations: Location[] }>(
    propertyId ? `/api/properties/${propertyId}/locations/` : null,
    apiFetch,
    { onError: (err) => toast.error(err.message || 'Failed to load locations') }
  )
  const locations = locationsData?.locations ?? []

  // UI States
  const [isAdding, setIsAdding] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // New Item State
  const defaultNewItem = { 
    name: '', price: '', category: 'Starters', subCategory: '', dietaryPreference: 'veg',
    preparationTime: '20', gstRate: '5.00', discountPercentage: '0.00', stockQuantity: '', 
    spiceLevel: '', ingredients: '', prepStation: 'main', isBestseller: false, imageUrl: ''
  }
  const [newItem, setNewItem] = useState(defaultNewItem)
  const [imageFile, setImageFile] = useState<File | null>(null)
  
  // Location State
  const [isAddingLoc, setIsAddingLoc] = useState(false)
  const [isSubmittingLoc, setIsSubmittingLoc] = useState(false)
  const [newLoc, setNewLoc] = useState({ label: '', kind: 'table', capacity: 2 })

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!propertyId) return
    setIsSubmittingLoc(true)
    try {
      await createLocation(propertyId, newLoc)
      toast.success('Location added successfully')
      mutateLocations()
      setIsAddingLoc(false)
      setNewLoc({ label: '', kind: 'table', capacity: 2 })
    } catch (err: any) {
      toast.error(err.message || 'Failed to add location')
    } finally {
      setIsSubmittingLoc(false)
    }
  }

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!propertyId) return toast.error('No property loaded.')
    
    setIsSubmitting(true)
    try {
      let imageUrl = newItem.imageUrl || ''
      if (imageFile) {
        const uploadToast = toast.loading('Uploading image...')
        const uploadRes = await uploadImage(imageFile)
        imageUrl = uploadRes.url
        toast.dismiss(uploadToast)
      }

      const payload = { 
        name: newItem.name, 
        price: newItem.price, 
        category: newItem.category,
        subCategory: newItem.subCategory || undefined,
        dietaryPreference: newItem.dietaryPreference,
        preparationTime: newItem.preparationTime ? parseInt(newItem.preparationTime as string) : undefined,
        gstRate: newItem.gstRate,
        discountPercentage: newItem.discountPercentage,
        stockQuantity: newItem.stockQuantity ? parseInt(newItem.stockQuantity as string) : undefined,
        spiceLevel: newItem.spiceLevel ? parseInt(newItem.spiceLevel as string) : undefined,
        ingredients: newItem.ingredients || undefined,
        prepStation: newItem.prepStation,
        isBestseller: newItem.isBestseller,
        imageUrl: imageUrl || undefined
      }

      if (editingItemId) {
        await updateMenuItem(editingItemId, payload)
        toast.success('Menu item updated successfully!')
      } else {
        await createMenuItem(propertyId, payload)
        toast.success('Menu item added beautifully!')
      }
      mutateMenu()
      setIsAdding(false)
      setEditingItemId(null)
      setNewItem(defaultNewItem)
      setImageFile(null)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save menu item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (item: MenuItem) => {
    setEditingItemId(item.id)
    setNewItem({
      name: item.name,
      price: item.price.toString(),
      category: item.category,
      subCategory: item.subCategory || '',
      dietaryPreference: item.dietaryPreference || 'veg',
      preparationTime: item.preparationTime?.toString() || '',
      gstRate: item.gstRate?.toString() || '5.00',
      discountPercentage: item.discountPercentage?.toString() || '0.00',
      stockQuantity: item.stockQuantity?.toString() || '',
      spiceLevel: item.spiceLevel?.toString() || '',
      ingredients: item.ingredients || '',
      prepStation: item.prepStation,
      isBestseller: item.isBestseller || false,
      imageUrl: item.imageUrl || ''
    })
    setIsAdding(true)
    setImageFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    const loadingToast = toast.loading(`Deleting ${name}...`)
    try {
      await deleteMenuItem(id)
      toast.success(`${name} deleted.`, { id: loadingToast })
      mutateMenu()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete item', { id: loadingToast })
    }
  }

  // Filter and Category logic
  const categories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map(item => item.category)))
    return ['All', ...cats.sort()]
  }, [menuItems])

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.category.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [menuItems, searchQuery, activeCategory])


  if (sessionLoading) {
    return (
      <div className="flex w-full h-[60vh] items-center justify-center text-orange-500">
        <Loader2 size={32} className="animate-spin" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-10 animate-in fade-in duration-700 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-orange-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 mb-2 font-outfit">
            Menu Universe
          </h2>
          <p className="text-zinc-400 max-w-xl text-lg">
            Curate and manage your culinary offerings with style. Add beautiful items, configure locations, and manage pricing.
          </p>
        </div>
        
        {isManagerOrAdmin && (
          <button 
            onClick={() => {
              if (isAdding) {
                setIsAdding(false)
                setEditingItemId(null)
                setNewItem(defaultNewItem)
              } else {
                setIsAdding(true)
              }
            }}
            className={`z-10 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 transform active:scale-95 ${
              isAdding 
                ? 'bg-white/10 text-zinc-300 hover:bg-white/20 border border-white/10' 
                : 'bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:-translate-y-1'
            }`}
          >
            {isAdding ? <Utensils size={18} /> : <PlusCircle size={18} />}
            {isAdding ? 'Close Builder' : 'Create Masterpiece'}
          </button>
        )}
      </div>

      {/* Add/Edit Item Form (Glassmorphism) */}
      {isAdding && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/50 animate-in slide-in-from-top-8 duration-500 z-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-xl border border-orange-500/20">
              <Utensils size={24} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white font-outfit">
                {editingItemId ? 'Edit Culinary Item' : 'New Culinary Item'}
              </h3>
              <p className="text-zinc-400 text-sm">
                {editingItemId ? 'Update the details of your menu offering.' : 'Fill in the details for your new menu offering.'}
              </p>
            </div>
          </div>
          
          <form onSubmit={handleAddMenu} className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
            {/* Core Info */}
            <div className="md:col-span-4 space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Item Name</label>
              <input type="text" required placeholder="e.g. Paneer Butter Masala" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all" />
            </div>
            
            <div className="md:col-span-3 space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Price (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500"><IndianRupee size={16} /></span>
                <input type="number" required min="0" step="0.01" placeholder="0.00" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-mono" />
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Category</label>
              <input type="text" required placeholder="e.g. Main Course" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Type</label>
              <select value={newItem.dietaryPreference} onChange={e => setNewItem({ ...newItem, dietaryPreference: e.target.value })}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all appearance-none cursor-pointer">
                <option value="veg" className="bg-zinc-900">🟢 Veg</option>
                <option value="non_veg" className="bg-zinc-900">🔴 Non-Veg</option>
                <option value="vegan" className="bg-zinc-900">🌱 Vegan</option>
              </select>
            </div>

            {/* Extended Info */}
            <div className="md:col-span-3 space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Clock size={12}/> Prep Time (mins)</label>
              <input type="number" min="0" placeholder="e.g. 20" value={newItem.preparationTime} onChange={e => setNewItem({ ...newItem, preparationTime: e.target.value })}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-mono" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Percent size={12}/> GST %</label>
              <input type="number" step="0.01" min="0" placeholder="5.00" value={newItem.gstRate} onChange={e => setNewItem({ ...newItem, gstRate: e.target.value })}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-mono" />
            </div>

            <div className="md:col-span-3 space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Flame size={12}/> Spice (1-5)</label>
              <select value={newItem.spiceLevel} onChange={e => setNewItem({ ...newItem, spiceLevel: e.target.value })}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all appearance-none">
                <option value="" className="bg-zinc-900">None</option>
                <option value="1" className="bg-zinc-900">1 - Mild</option>
                <option value="2" className="bg-zinc-900">2 - Medium</option>
                <option value="3" className="bg-zinc-900">3 - Spicy</option>
                <option value="4" className="bg-zinc-900">4 - Very Spicy</option>
                <option value="5" className="bg-zinc-900">5 - Extreme</option>
              </select>
            </div>

            <div className="md:col-span-4 space-y-2 flex flex-col justify-end">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Mouth-watering Image</label>
              <div className="relative group">
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-zinc-400 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-orange-500/20 file:text-orange-400 hover:file:bg-orange-500/30 transition-all cursor-pointer" />
              </div>
            </div>
            
            <div className="md:col-span-12 flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={newItem.isBestseller} onChange={e => setNewItem({...newItem, isBestseller: e.target.checked})} className="sr-only" />
                  <div className={`w-10 h-6 rounded-full transition-colors ${newItem.isBestseller ? 'bg-orange-500' : 'bg-white/10 border border-white/20'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${newItem.isBestseller ? 'translate-x-4' : ''}`}></div>
                </div>
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Mark as Bestseller ✨</span>
              </label>
            </div>

            <div className="md:col-span-12 mt-4">
              <button type="submit" disabled={isSubmitting}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 font-bold text-lg rounded-xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] focus:outline-none disabled:opacity-50 hover:-translate-y-1">
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : (editingItemId ? <Edit2 size={20} /> : <Plus size={20} />)}
                {isSubmitting ? 'Saving...' : (editingItemId ? 'Update Item' : 'Add to Menu')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Menu Catalog */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Toolbar */}
          <div className="flex flex-col gap-4 bg-white/[0.02] backdrop-blur-md border border-white/5 p-4 rounded-3xl">
            {/* Search */}
            <div className="relative w-full md:w-96 group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search dishes, ingredients..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 pl-12 pr-4 py-3 rounded-2xl text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
              />
            </div>
            
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full pt-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                      activeCategory === cat 
                        ? 'bg-orange-500 text-white shadow-[0_4px_15px_rgba(249,115,22,0.4)]' 
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 border border-white/5 hover:border-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
            </div>
          </div>

          {/* Menu Grid - Adjusted to be smaller */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filteredItems.map((item, index) => (
              <div 
                key={item.id} 
                className="group relative bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden hover:bg-white/[0.04] hover:border-orange-500/30 transition-all duration-500 flex flex-col animate-in fade-in zoom-in-95"
                style={{ animationDelay: `${(index % 12) * 50}ms`, animationFillMode: 'both' }}
              >
                {/* Image Area - Reduced height */}
                <div className="relative h-36 w-full bg-black/50 overflow-hidden">
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                      <Utensils size={28} className="mb-2 opacity-50" />
                      <span className="text-[10px] uppercase tracking-widest font-semibold">No Image</span>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  {/* Badges on Image */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {item.isBestseller && (
                      <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-zinc-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
                        <Flame size={10} /> Bestseller
                      </span>
                    )}
                  </div>
                  
                  <div className="absolute top-3 right-3">
                    {item.dietaryPreference === 'veg' && (
                      <div className="bg-green-950/80 backdrop-blur-md border border-green-500/50 rounded p-1 shadow-lg" title="Vegetarian">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      </div>
                    )}
                    {item.dietaryPreference === 'non_veg' && (
                      <div className="bg-red-950/80 backdrop-blur-md border border-red-500/50 rounded p-1 shadow-lg" title="Non-Vegetarian">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                    <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                      {item.category}
                    </span>
                    <span className="text-xl font-black text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      ₹{item.price}
                    </span>
                  </div>
                </div>

                {/* Content Area - Reduced padding */}
                <div className="p-4 flex-1 flex flex-col">
                  <h4 className="text-base font-bold text-zinc-100 mb-1 group-hover:text-orange-400 transition-colors font-outfit">{item.name}</h4>
                  
                  {item.description ? (
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-3 flex-1">{item.description}</p>
                  ) : (
                    <div className="flex-1"></div>
                  )}
                  
                  <div className="mt-2 flex flex-wrap items-center gap-3 pt-3 border-t border-white/5 text-[11px] text-zinc-500 font-medium">
                    {item.preparationTime && (
                      <span className="flex items-center gap-1"><Clock size={12} className="text-orange-400/70" /> {item.preparationTime}m</span>
                    )}
                    {item.spiceLevel ? (
                      <span className="flex items-center gap-1">
                        <Flame size={12} className={item.spiceLevel > 3 ? "text-red-500" : "text-amber-500"} /> 
                        Level {item.spiceLevel}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Actions Hover Overlay */}
                {isManagerOrAdmin && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 z-10">
                    <button 
                      onClick={(e) => { e.preventDefault(); handleEdit(item); }}
                      className="p-2.5 bg-blue-500/90 hover:bg-blue-500 text-white rounded-full shadow-xl backdrop-blur-md transition-colors hover:scale-110"
                      title="Edit Item"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleDelete(item.id, item.name); }}
                      className="p-2.5 bg-red-500/90 hover:bg-red-500 text-white rounded-full shadow-xl backdrop-blur-md transition-colors hover:scale-110"
                      title="Delete Item"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!menuLoading && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center p-20 bg-white/[0.02] border border-white/5 rounded-3xl">
              <Utensils size={48} className="text-zinc-700 mb-4" />
              <h3 className="text-xl font-bold text-zinc-300">No items found</h3>
              <p className="text-zinc-500 mt-2">Try adjusting your filters or search query.</p>
            </div>
          )}

          {menuLoading && (
            <div className="flex justify-center p-20">
              <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
          )}
        </div>

        {/* Locations Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden sticky top-8 shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-xl text-white font-outfit flex items-center gap-2">
                  <MapPin size={20} className="text-orange-500" />
                  Service Areas
                </h3>
              </div>
              <p className="text-sm text-zinc-400">Configure zones where guests can order.</p>
            </div>

            <div className="p-5">
              {isManagerOrAdmin && (
                <button 
                  onClick={() => setIsAddingLoc(!isAddingLoc)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 mb-5 ${
                    isAddingLoc 
                      ? 'bg-white/10 text-white' 
                      : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 hover:border-white/10'
                  }`}
                >
                  <Plus size={16} className={isAddingLoc ? 'rotate-45 transition-transform' : 'transition-transform'} /> 
                  {isAddingLoc ? 'Cancel' : 'New Area'}
                </button>
              )}

              {isAddingLoc && (
                <form onSubmit={handleAddLocation} className="space-y-4 bg-black/20 p-5 rounded-2xl border border-white/10 mb-6 animate-in slide-in-from-top-2">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 mb-1.5 block uppercase tracking-wider">Label (e.g. Table 4)</label>
                    <input type="text" required value={newLoc.label} onChange={e => setNewLoc({ ...newLoc, label: e.target.value })}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-zinc-500 mb-1.5 block uppercase tracking-wider">Type</label>
                      <select value={newLoc.kind} onChange={e => setNewLoc({ ...newLoc, kind: e.target.value })}
                        className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500/50 appearance-none">
                        <option value="table" className="bg-zinc-900">Table</option>
                        <option value="room" className="bg-zinc-900">Room</option>
                        <option value="counter" className="bg-zinc-900">Counter</option>
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="text-xs font-semibold text-zinc-500 mb-1.5 block uppercase tracking-wider">Cap</label>
                      <input type="number" min="1" required value={newLoc.capacity} onChange={e => setNewLoc({ ...newLoc, capacity: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500/50 text-center" />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmittingLoc} className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 text-sm font-bold rounded-xl disabled:opacity-50 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all mt-2">
                    {isSubmittingLoc ? 'Saving...' : 'Save Area'}
                  </button>
                </form>
              )}

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {locations.map((loc, i) => (
                  <div key={loc.id} className="group p-4 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-orange-500/30 rounded-2xl transition-all duration-300 flex items-center justify-between cursor-pointer animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="relative z-10 flex flex-col gap-1">
                      <div className="font-bold text-zinc-100 text-sm">{loc.label}</div>
                      <div className="text-xs text-zinc-500 flex items-center gap-2 font-medium">
                        <span className="capitalize px-2 py-0.5 bg-white/5 text-zinc-300 rounded-md border border-white/5">{loc.kind}</span>
                        <span className="flex items-center gap-1"><Utensils size={10}/> {loc.capacity} pax</span>
                      </div>
                    </div>
                    <div className="relative z-10">
                      {loc.active ? (
                        <div className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-zinc-900"></span>
                        </div>
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-white/20 border-2 border-zinc-900"></div>
                      )}
                    </div>
                  </div>
                ))}
                
                {!locLoading && locations.length === 0 && (
                  <div className="p-10 text-center flex flex-col items-center gap-3 bg-white/[0.01] rounded-2xl border border-white/5">
                    <MapPin size={32} className="text-zinc-600" />
                    <p className="text-zinc-500 text-sm font-medium">No locations configured yet.</p>
                  </div>
                )}
                {locLoading && locations.length === 0 && (
                  <div className="p-10 flex justify-center"><Loader2 size={28} className="animate-spin text-orange-500" /></div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}