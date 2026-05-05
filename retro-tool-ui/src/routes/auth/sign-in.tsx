import { createFileRoute, Link, useSearch } from '@tanstack/react-router'
import {
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Ban,
  XCircle,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  CalendarClock,
  ListTodo,
  Trophy,
  Users,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { useSignIn } from './hooks'
import type { SignInSearch } from './types'

export const Route = createFileRoute('/auth/sign-in')({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    status: search.status as SignInSearch['status'],
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    inviteToken:
      typeof search.inviteToken === 'string' ? search.inviteToken : undefined,
    email: typeof search.email === 'string' ? search.email : undefined,
  }),
  component: SignInPage,
})

// ─── Activity feed data ────────────────────────────────────────────────────────
const ACTIVITY = [
  {
    icon: Sparkles,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Engineering team started a retro',
    meta: 'just now',
    dot: 'bg-emerald-400',
    live: true,
  },
  {
    icon: CheckCircle2,
    iconColor: 'text-teal-400',
    iconBg: 'bg-teal-500/10 border-teal-500/20',
    title: '3 action items marked complete',
    meta: '1h ago',
    dot: null,
    live: false,
  },
  {
    icon: MessageSquare,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    title: 'Sarah commented on your card',
    meta: '2h ago',
    dot: null,
    live: false,
  },
  {
    icon: CalendarClock,
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
    title: 'Next retro: Product Team · Tomorrow 2 pm',
    meta: 'upcoming',
    dot: null,
    live: false,
  },
  {
    icon: Trophy,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    title: 'Sprint 24 Retro report is ready',
    meta: 'yesterday',
    dot: null,
    live: false,
  },
]

const METRICS = [
  { icon: Users, value: '500+', label: 'Teams' },
  { icon: ListTodo, value: '12K+', label: 'Retros' },
  { icon: TrendingUp, value: '98%', label: 'Satisfaction' },
]

// ─── Left visual panel ─────────────────────────────────────────────────────────
function VisualPanel() {
  return (
    <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 xl:p-12 relative overflow-hidden">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Glow blob */}
      <div className="absolute top-1/3 -left-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Headline */}
      <div className="relative">
        <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-3">
          Your team is
          <br />
          <span className="text-emerald-400">waiting for you.</span>
        </h1>
        <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
          Sign in to pick up where you left off — retros, action items, and team
          insights all in one place.
        </p>
      </div>

      {/* Activity feed */}
      <div className="relative my-4 xl:my-0 max-w-xs">
        <div className="flex items-center gap-2 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">
            Live activity
          </p>
        </div>
        <div className="space-y-1.5">
          {ACTIVITY.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="flex items-center gap-2.5 bg-[#161b22] border border-[#21262d] rounded-lg px-3 py-2
                  hover:border-emerald-500/20 transition-colors duration-200"
              >
                <div
                  className={`p-1 rounded-md border shrink-0 ${item.iconBg}`}
                >
                  <Icon className={`h-3 w-3 ${item.iconColor}`} />
                </div>
                <p className="text-xs text-gray-400 flex-1 leading-snug truncate">
                  {item.title}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  {item.live && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  <span className="text-xs text-gray-600">{item.meta}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Metrics */}
      <div className="relative flex items-center gap-8 pt-4 border-t border-[#21262d]">
        {METRICS.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <Icon className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-base font-bold text-white leading-none">
                {value}
              </p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Shared page shell ─────────────────────────────────────────────────────────
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-56px)] relative overflow-hidden">
      {/* Full-page mesh grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Glow blob */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <VisualPanel />
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-10 sm:px-8 relative">
        <div className="w-full max-w-sm sm:max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <img
                src="/Retro-Tool-Logo.jpg"
                alt="Retro-Tool"
                className="h-8 w-8 rounded-lg object-cover"
              />
              <span className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Retro-Tool
              </span>
            </Link>
            <div className="flex items-center justify-center gap-3 mt-4">
              {METRICS.map(({ value, label }) => (
                <div
                  key={label}
                  className="px-3 py-1 rounded-full bg-[#161b22] border border-[#21262d] text-xs text-gray-400"
                >
                  <span className="text-white font-semibold">{value}</span>{' '}
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Card */}
          <div className="bg-[#161b22] rounded-2xl border border-[#21262d] shadow-[0_25px_60px_-15px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="h-0.5 w-full bg-linear-to-r from-transparent via-emerald-500 to-transparent" />
            <div className="p-6 sm:p-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
function SignInPage() {
  const {
    status,
    redirect,
    inviteToken,
    email: emailFromInvite,
  } = useSearch({ from: '/auth/sign-in' })
  const resolvedRedirect = inviteToken
    ? `/auth/accept-invite?token=${encodeURIComponent(inviteToken)}`
    : redirect
  const [email, setEmail] = useState(emailFromInvite ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pendingApproval, setPendingApproval] = useState(status === 'pending')
  const [rejected, setRejected] = useState(status === 'rejected')
  const [suspended, setSuspended] = useState(false)

  const signInMutation = useSignIn({
    onPendingApproval: () => setPendingApproval(true),
    onRejected: () => setRejected(true),
    onSuspended: () => setSuspended(true),
    redirect: resolvedRedirect,
  })

  const error = signInMutation.error?.message ?? ''
  const loading = signInMutation.isPending

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    setPendingApproval(false)
    setRejected(false)
    setSuspended(false)
    signInMutation.mutate({ email, password })
  }

  if (pendingApproval) {
    return (
      <PageShell>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-6 animate-pulse border border-amber-500/30">
            <Clock className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Approval Pending
          </h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
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
            className="border-amber-500 text-amber-400 hover:bg-amber-500/10 transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(251,191,36,0.3)]"
          >
            Try Another Account
          </Button>
        </div>
      </PageShell>
    )
  }

  if (rejected) {
    return (
      <PageShell>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6 border border-red-500/30">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Account Not Approved
          </h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
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
            className="border-red-500 text-red-400 hover:bg-red-500/10 transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(239,68,68,0.3)]"
          >
            Try Another Account
          </Button>
        </div>
      </PageShell>
    )
  }

  if (suspended) {
    return (
      <PageShell>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-6 border border-orange-500/30">
            <Ban className="h-8 w-8 text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Account Suspended
          </h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            Your account has been suspended. Please contact your organization
            admin for assistance.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSuspended(false)
              setEmail('')
              setPassword('')
            }}
            className="border-orange-500 text-orange-400 hover:bg-orange-500/10 transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(249,115,22,0.3)]"
          >
            Try Another Account
          </Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      {/* Header */}
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
        <p className="text-sm text-gray-400">
          Sign in to your account to continue
        </p>
      </div>

      {inviteToken && emailFromInvite && (
        <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <p className="text-emerald-300 font-medium mb-1">
            You're accepting an invitation
          </p>
          <p className="text-gray-400 text-xs leading-relaxed">
            Sign in with{' '}
            <span className="text-emerald-400 font-mono">
              {emailFromInvite}
            </span>{' '}
            — the email this invite was sent to. You'll be redirected back to
            accept once signed in.
          </p>
          <p className="text-gray-500 text-xs leading-relaxed mt-2">
            New to Retro-Tool?{' '}
            <Link
              to="/auth/sign-up"
              search={{ inviteToken, email: emailFromInvite }}
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Create an account
            </Link>{' '}
            with this email instead.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
            <p>{error}</p>
            {inviteToken && emailFromInvite && (
              <p className="mt-2 text-xs text-gray-400">
                Don't have an account yet?{' '}
                <Link
                  to="/auth/sign-up"
                  search={{ inviteToken, email: emailFromInvite }}
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Create one with {emailFromInvite}
                </Link>{' '}
                or{' '}
                <Link
                  to="/auth/forgot-password"
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  reset your password
                </Link>
                .
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-gray-300 text-sm">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 bg-[#0d1117] border-[#21262d] text-white placeholder:text-gray-600 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-gray-300 text-sm">
              Password
            </Label>
            <Link
              to="/auth/forgot-password"
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 pr-10 bg-[#0d1117] border-[#21262d] text-white placeholder:text-gray-600 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-400 transition-colors"
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
          disabled={loading}
          className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0 mt-2"
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

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#21262d]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#161b22] px-2 text-gray-600">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-11 border-[#21262d] bg-white dark:bg-white text-gray-900 dark:text-gray-900 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-gray-100 dark:hover:text-gray-900 font-medium transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_-8px_rgba(0,0,0,0.4)]"
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

      <div className="mt-6 space-y-3">
        <p className="text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <Link
            to="/auth/sign-up"
            search={
              inviteToken && emailFromInvite
                ? { inviteToken, email: emailFromInvite }
                : undefined
            }
            className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Sign up
          </Link>
        </p>
        <p className="text-center text-xs text-gray-600">
          By signing in you agree to our{' '}
          <Link
            to="/termsofservice"
            className="text-gray-500 hover:text-emerald-400 underline underline-offset-2 transition-colors"
          >
            Terms
          </Link>{' '}
          and{' '}
          <Link
            to="/privacystatement"
            className="text-gray-500 hover:text-emerald-400 underline underline-offset-2 transition-colors"
          >
            Privacy Statement
          </Link>
        </p>
      </div>
    </PageShell>
  )
}
