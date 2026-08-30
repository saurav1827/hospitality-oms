'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutate } from 'swr'
import { fetchSession, loginMutation, signupMutation } from '@/lib/api-client'
import { Utensils, CircleAlert, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'

const MIN_PASSWORD_LENGTH = 8

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Priming call for CSRF cookie
    fetchSession().catch(() => { })
  }, [])

  const switchMode = (toLogin: boolean) => {
    setIsLogin(toLogin)
    setError(null)
    setPassword('')
    setConfirmPassword('')
  }

  const validate = (): string | null => {
    const trimmed = username.trim()
    if (!trimmed) return 'Username is required'
    if (trimmed.length < 3) return 'Username must be at least 3 characters'
    if (!password) return 'Password is required'
    if (!isLogin) {
      if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      if (password !== confirmPassword) return 'Passwords do not match'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const mutation = isLogin ? loginMutation : signupMutation
      const result = await mutation({ username: username.trim(), password })

      // Update SWR cache immediately with the returned session data so layout doesn't kick us out
      await mutate('/api/auth/session/', result, { revalidate: false })
      router.push('/')
    } catch (err: any) {
      setError(err?.message || (isLogin ? 'Login failed' : 'Signup failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
      
      {/* Left Pane: Branding / Marketing Visual */}
      <div className="hidden lg:flex flex-1 relative flex-col justify-between p-12 overflow-hidden bg-zinc-900 border-r border-zinc-800/50">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <Utensils size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">Tableline</span>
        </div>

        <div className="relative z-10 max-w-lg mb-12">
          <h1 className="text-5xl font-bold tracking-tighter leading-[1.1] mb-6">
            Orchestrate your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              hospitality empire.
            </span>
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed">
            Streamline orders, manage kitchen workflows, and deliver exceptional dining experiences with our state-of-the-art operations OS.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-sm text-zinc-500 font-medium">
          <span>© {new Date().getFullYear()} Tableline Inc.</span>
          <span className="w-1 h-1 rounded-full bg-zinc-700" />
          <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
          <span className="w-1 h-1 rounded-full bg-zinc-700" />
          <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
        </div>
      </div>

      {/* Right Pane: Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-24 xl:px-32 relative bg-zinc-950">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-3 mb-12">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <Utensils size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">Tableline</span>
        </div>

        <div className="w-full max-w-[420px] mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight mb-2">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-zinc-400">
              {isLogin 
                ? 'Enter your credentials to access your workspace.' 
                : 'Set up a new workspace for your property.'}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex p-1 mb-8 bg-zinc-900/50 rounded-lg ring-1 ring-zinc-800/50 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => switchMode(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                isLogin 
                  ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                !isLogin 
                  ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 text-red-400 ring-1 ring-red-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                <p className="text-sm font-medium leading-relaxed">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                autoComplete="username"
                placeholder="e.g. chef_ramsay"
                className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                required 
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300">Password</label>
                {isLogin && (
                  <a href="#" className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all pr-12"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(s => !s)} 
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-sm font-medium text-zinc-300">Confirm Password</label>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  required 
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight size={18} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
          
        </div>
      </div>
    </div>
  )
}