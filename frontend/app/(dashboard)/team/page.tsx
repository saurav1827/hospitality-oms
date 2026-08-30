'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSession } from '@/lib/use-session'
import { fetchTeamMembers, addTeamMember, updateTeamMemberRole, removeTeamMember, type TeamMember } from '@/lib/api-client'
import { Plus, Shield, User, Loader2, Edit2, UserX, X, Check, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Full system access' },
  { value: 'manager', label: 'Manager', description: 'Can manage menus, orders, and staff' },
  { value: 'waiter', label: 'Waiter', description: 'Takes orders and serves tables' },
  { value: 'kitchen', label: 'Kitchen', description: 'Manages incoming food orders' },
  { value: 'cashier', label: 'Cashier', description: 'Handles billing and payments' },
  { value: 'runner', label: 'Runner', description: 'Delivers food to tables' },
]

export default function TeamAccessPage() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const propertyId = session?.propertyId ?? ''

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/login')
  }, [sessionLoading, session, router])

  const { data: teamData, mutate: mutateTeam } = useSWR<{ team: TeamMember[] }>(
    propertyId ? [`/api/properties/${propertyId}/team/`] : null,
    (): Promise<{ team: TeamMember[] }> => fetchTeamMembers(propertyId)
  )
  const team = teamData?.team ?? []

  // Add Member Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newRole, setNewRole] = useState('waiter')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit Role State
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingRole, setEditingRole] = useState<string>('')

  // Search State
  const [searchQuery, setSearchQuery] = useState('')

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim()) {
      toast.error('Username is required')
      return
    }

    setIsSubmitting(true)
    try {
      await addTeamMember(propertyId, { username: newUsername, role: newRole })
      toast.success('Team member added successfully!')
      setNewUsername('')
      setNewRole('waiter')
      setIsAddModalOpen(false)
      mutateTeam()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add team member')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveRole = async (userId: number) => {
    try {
      await updateTeamMemberRole(propertyId, userId, editingRole)
      toast.success('Role updated successfully!')
      setEditingUserId(null)
      mutateTeam()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update role')
    }
  }

  const handleRemoveMember = async (userId: number, username: string) => {
    if (session?.username === username) {
      toast.error("You cannot remove yourself from the property.")
      return
    }

    if (!confirm(`Are you sure you want to remove ${username} from the team?`)) return

    try {
      await removeTeamMember(propertyId, userId)
      toast.success('Team member removed')
      mutateTeam()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove team member')
    }
  }

  const filteredTeam = team.filter(member =>
    member.active && (
      member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  if (sessionLoading) return null
  if (!session) return null

  // Ensure only admins/managers can see this page
  if (session.role !== 'admin' && session.role !== 'manager') {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center">
        <Shield size={48} className="text-red-500 mb-4 opacity-20" />
        <h2 className="text-xl font-bold tracking-tight text-zinc-100">Access Denied</h2>
        <p className="text-sm text-zinc-500 mt-2">You do not have permission to manage team access.</p>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] text-zinc-100 p-6 sm:p-8 font-sans">

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 max-w-5xl mx-auto"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Team Management</h2>
            <p className="text-sm text-zinc-500 mt-1">Manage staff roles, permissions, and venue access.</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 text-sm font-bold rounded-lg shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.4)] transition-all"
          >
            <Plus size={16} /> New member
          </button>
        </div>

        {/* Main Content Area */}
        <div className="bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl backdrop-blur-xl">

          {/* Toolbar */}
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/5">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 border border-white/10 text-zinc-200 text-sm rounded-lg pl-9 pr-4 py-2 focus:ring-orange-500 focus:border-orange-500 placeholder-zinc-500"
              />
            </div>
            <div className="text-sm text-zinc-500">
              <strong className="text-zinc-200 font-medium">{filteredTeam.length}</strong> active members
            </div>
          </div>

          {/* Team Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-white/5 text-zinc-400 text-xs font-medium border-b border-white/10">
                <tr>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filteredTeam.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16 text-center">
                        <UserX size={32} className="mx-auto text-zinc-700 mb-3" />
                        <p className="text-zinc-400 text-sm">No team members found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTeam.map((member) => (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={member.id}
                        className="group border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400 border border-zinc-700/50">
                              <User size={14} />
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-zinc-200 tracking-tight">{member.username}</span>
                                {session.username === member.username && (
                                  <span className="text-[10px] font-semibold bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded tracking-wide uppercase">You</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {editingUserId === member.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={editingRole}
                                onChange={(e) => setEditingRole(e.target.value)}
                                className="bg-black/20 border border-white/10 text-zinc-200 text-sm rounded-md focus:outline-none focus:border-orange-500 px-2 py-1 shadow-sm"
                              >
                                {ROLE_OPTIONS.map(opt => (
                                  <option className="bg-zinc-900 text-zinc-100" key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              <button onClick={() => handleSaveRole(member.id)} className="p-1 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors">
                                <Check size={16} />
                              </button>
                              <button onClick={() => setEditingUserId(null)} className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-zinc-300 border border-white/10 capitalize">
                              {member.role.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {member.isOnline ? (
                            <span className="inline-flex items-center gap-1.5 text-zinc-300 text-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-zinc-500 text-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                              Offline
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {editingUserId !== member.id && (
                              <button
                                onClick={() => { setEditingUserId(member.id); setEditingRole(member.role); }}
                                className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                                title="Edit Role"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {session.username !== member.username && (
                              <button
                                onClick={() => handleRemoveMember(member.id, member.username)}
                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                                title="Remove Member"
                              >
                                <UserX size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md" onClick={() => setIsAddModalOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-black/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-100">Add Team Member</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Invite a new staff member to the venue</p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="p-5 space-y-5">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    placeholder="e.g. chef_ramsay"
                    className="w-full p-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors shadow-sm"
                    required
                  />
                  <p className="text-[11px] text-zinc-500 mt-1.5">New users will use <code className="font-mono bg-zinc-800 px-1 py-0.5 rounded">welcome123</code> as their default password.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Assign Role</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1">
                    {ROLE_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        onClick={() => setNewRole(opt.value)}
                        className={`cursor-pointer p-3 rounded-xl border-2 flex items-center justify-between transition-all ${newRole === opt.value
                            ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-[inset_0_0_15px_rgba(249,115,22,0.1)]'
                            : 'bg-black/40 border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-400'
                          }`}
                      >
                        <div>
                          <div className={`font-semibold text-sm tracking-tight ${newRole === opt.value ? 'text-orange-400' : 'text-zinc-300'}`}>
                            {opt.label}
                          </div>
                          <div className="text-[11px] opacity-70 mt-0.5">{opt.description}</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${newRole === opt.value ? 'border-orange-500 bg-orange-500' : 'border-zinc-600'
                          }`}>
                          {newRole === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newUsername.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.4)]"
                  >
                    {isSubmitting ? (
                      <><Loader2 size={16} className="animate-spin" /> Adding...</>
                    ) : (
                      <>Add Member</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}