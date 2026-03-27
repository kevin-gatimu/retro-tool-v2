import { createFileRoute, Link, useSearch } from '@tanstack/react-router'
import {
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Ban,
  XCircle,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DetailPageSkeleton } from '@/components/skeletons'
import { authClient } from '@/lib/auth-client'
import { useSignIn } from './hooks'
import type { SignInSearch } from './types'

export const Route = createFileRoute('/auth/sign-in')({
  pendingComponent: DetailPageSkeleton,
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    status: search.status as SignInSearch['status'],
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const { status, redirect } = useSearch({ from: '/auth/sign-in' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pendingApproval, setPendingApproval] = useState(status === 'pending')
  const [rejected, setRejected] = useState(status === 'rejected')
  const [suspended, setSuspended] = useState(false)

  const signInMutation = useSignIn({
    onPendingApproval: () => setPendingApproval(true),
    onRejected: () => setRejected(true),
    onSuspended: () => setSuspended(true),
    redirect,
  })

  const error = signInMutation.error?.message ?? ''
  const loading = signInMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPendingApproval(false)
    setRejected(false)
    setSuspended(false)
    signInMutation.mutate({ email, password })
  }

  if (pendingApproval) {
    return (
      <div className="relative">
        <div className="flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-6
						animate-pulse border border-amber-500/30"
          >
            <Clock className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Approval Pending
          </h2>
          <p className="text-gray-400 mb-8">
            Your account is awaiting administrator approval. Please check back
            later or contact an administrator.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setPendingApproval(false)
              setEmail('')
              setPassword('')
            }}
            className="border-amber-500 text-amber-400 hover:bg-amber-500/10
							transition-all duration-300 hover:scale-105 hover:-translate-y-1
							hover:shadow-[0_15px_30px_-10px_rgba(251,191,36,0.3)]"
          >
            Try Another Account
          </Button>
        </div>
      </div>
    )
  }

  if (rejected) {
    return (
      <div className="relative">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6 border border-red-500/30">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Account Not Approved
          </h2>
          <p className="text-gray-400 mb-8">
            Your account request was not approved. Please contact an
            administrator if you believe this is an error.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setRejected(false)
              setEmail('')
              setPassword('')
            }}
            className="border-red-500 text-red-400 hover:bg-red-500/10
							transition-all duration-300 hover:scale-105 hover:-translate-y-1
							hover:shadow-[0_15px_30px_-10px_rgba(239,68,68,0.3)]"
          >
            Try Another Account
          </Button>
        </div>
      </div>
    )
  }

  if (suspended) {
    return (
      <div className="relative">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-6 border border-orange-500/30">
            <Ban className="h-8 w-8 text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Account Suspended
          </h2>
          <p className="text-gray-400 mb-8">
            Your account has been suspended. Please contact your organization
            admin or system admin for assistance.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSuspended(false)
              setEmail('')
              setPassword('')
            }}
            className="border-orange-500 text-orange-400 hover:bg-orange-500/10
							transition-all duration-300 hover:scale-105 hover:-translate-y-1
							hover:shadow-[0_15px_30px_-10px_rgba(249,115,22,0.3)]"
          >
            Try Another Account
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex flex-col items-center mb-5">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full scale-150" />
            <img
              src="/Retro-Tool-Logo.jpg"
              alt="Retro-Tool"
              className="relative h-20 w-20 rounded-2xl object-cover shadow-[0_8px_32px_rgba(16,185,129,0.3)] border border-emerald-500/20"
            />
          </div>
          <h1 className="text-2xl font-bold italic text-white tracking-tight">
            Retro-Tool
          </h1>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Welcome back</h2>
        <p className="text-gray-400 text-sm">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-300">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-[#0d1117] border-gray-700 text-white placeholder:text-gray-500
							focus:border-emerald-500 focus:ring-emerald-500/20
							transition-all duration-300"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-gray-300">
              Password
            </Label>
            <Link
              to="/auth/forgot-password"
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative group">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10 bg-[#0d1117] border-gray-700 text-white placeholder:text-gray-500
								focus:border-emerald-500 focus:ring-emerald-500/20
								transition-all duration-300"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-400 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold
						transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
						hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]
						disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4" strokeWidth={3} />
              Sign in
            </span>
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#0d1117] px-2 text-gray-500">
            Or continue with
          </span>
        </div>
      </div>

      {/* Microsoft Sign In */}
      <Button
        type="button"
        variant="outline"
        className="w-full border-gray-700 bg-white dark:bg-[#f0eeeb] text-gray-900 hover:bg-gray-100 dark:hover:bg-[#e8e6e3]
          font-medium transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
          hover:shadow-[0_10px_20px_-8px_rgba(0,0,0,0.4)]"
        onClick={() =>
          authClient.signIn.social({
            provider: 'microsoft',
            callbackURL: `${window.location.origin}/auth/social-callback`,
          })
        }
      >
        <svg
          className="mr-2 h-4 w-4"
          viewBox="0 0 21 21"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
        Sign in with Microsoft
      </Button>

      <div className="mt-6 text-center text-sm text-gray-400">
        Don't have an account?{' '}
        <Link
          to="/auth/sign-up"
          className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          Sign up
        </Link>
      </div>
    </div>
  )
}
