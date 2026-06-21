import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronRight,
  Clock,
  Crown,
  Eye,
  EyeOff,
  Sparkles,
  Shield,
  Zap,
  Users,
  BarChart3,
  CheckCircle2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { allPasswordRequirementsMet, getPasswordRequirements } from './helpers'
import { useAdminCheck, useSignUp } from './hooks'

export const Route = createFileRoute('/auth/sign-up')({
  component: SignUpPage,
})

// ─── Mock retro board (decorative) ────────────────────────────────────────────
const BOARD_COLUMNS = [
  {
    label: 'Went Well',
    color: 'border-emerald-500/40',
    headerColor: 'text-emerald-400',
    dotColor: 'bg-emerald-500',
    cards: ['Team communicated clearly', 'Shipped on schedule'],
  },
  {
    label: 'Improve',
    color: 'border-amber-500/40',
    headerColor: 'text-amber-400',
    dotColor: 'bg-amber-500',
    cards: ['More async updates', 'Better estimation'],
  },
  {
    label: 'Action Items',
    color: 'border-rose-500/40',
    headerColor: 'text-rose-400',
    dotColor: 'bg-rose-500',
    cards: ['Weekly standup notes', 'Refine backlog Fri'],
  },
]

const STATS = [
  { value: '500+', label: 'Teams' },
  { value: '12K+', label: 'Retros run' },
  { value: '98%', label: 'Satisfaction' },
]

const FEATURES = [
  { icon: Zap, text: 'Live collaboration — cards appear in real-time' },
  { icon: Shield, text: 'Private by default — your data stays yours' },
  { icon: Users, text: 'Scales from 2-person startups to enterprises' },
  { icon: BarChart3, text: 'Analytics & action item tracking built in' },
]

// ─── Visual panel ─────────────────────────────────────────────────────────────
function VisualPanel() {
  return (
    <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 xl:p-12 relative overflow-hidden">
      {/* Top: headline */}
      <div className="relative">
        <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
          Better retrospectives
          <br />
          <span className="text-emerald-400">start here.</span>
        </h1>
        <p className="text-gray-400 text-base max-w-sm leading-relaxed">
          Structure your team's reflection, surface what matters, and turn
          insights into action — all in one place.
        </p>
      </div>

      {/* Middle: mini retro board */}
      <div className="relative my-6 xl:my-0 max-w-xs">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-2 font-medium">
          Live board preview
        </p>
        <div className="grid grid-cols-3 gap-2">
          {BOARD_COLUMNS.map((col) => (
            <div
              key={col.label}
              className={`bg-[#161b22] rounded-lg border ${col.color} p-2 space-y-1.5`}
            >
              <div className="flex items-center gap-1 mb-2">
                <span className={`h-1.5 w-1.5 rounded-full ${col.dotColor}`} />
                <span
                  className={`text-[10px] font-semibold ${col.headerColor}`}
                >
                  {col.label}
                </span>
              </div>
              {col.cards.map((card) => (
                <div
                  key={card}
                  className="bg-[#0d1117] rounded px-2 py-1.5 text-[10px] text-gray-500 border border-[#21262d] leading-snug"
                >
                  {card}
                </div>
              ))}
              {/* Ghost card */}
              <div className="bg-[#0d1117]/50 rounded px-2 py-1.5 border border-dashed border-[#21262d] h-6 opacity-40" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: features + stats */}
      <div className="relative space-y-6">
        <ul className="space-y-2.5">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 text-gray-400 text-sm"
            >
              <div className="p-1 rounded-md bg-emerald-500/10 shrink-0">
                <Icon className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              {text}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-6 pt-2 border-t border-[#21262d]">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Success states ───────────────────────────────────────────────────────────
function SuccessAdmin() {
  return (
    <div className="text-center">
      <div className="relative mx-auto mb-6 w-fit">
        <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
        <div className="relative p-4 bg-linear-to-br from-emerald-500/20 to-transparent rounded-full border border-emerald-500/30 animate-pulse">
          <Crown className="h-12 w-12 text-emerald-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">Welcome, Admin!</h2>
      <p className="text-gray-400 mb-8">
        You're the first user — you've been automatically made an administrator.
        Sign in to access your dashboard.
      </p>
      <Button
        asChild
        className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]"
      >
        <Link to="/auth/sign-in" className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4" strokeWidth={3} />
          Sign In
        </Link>
      </Button>
    </div>
  )
}

function SuccessPending() {
  return (
    <div className="text-center">
      <div className="relative mx-auto mb-6 w-fit">
        <div className="absolute inset-0 bg-amber-500/30 blur-2xl rounded-full scale-150" />
        <div className="relative p-4 bg-linear-to-br from-amber-500/20 to-transparent rounded-full border border-amber-500/30 animate-pulse">
          <Clock className="h-12 w-12 text-amber-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">
        Account Pending Approval
      </h2>
      <p className="text-gray-400 mb-8">
        Your account has been created. An administrator will review and approve
        your request — you'll be notified once approved.
      </p>
      <Button
        asChild
        className="bg-transparent border border-emerald-500 text-emerald-400 font-semibold hover:bg-emerald-500/10 transition-all duration-300 hover:scale-[1.02]"
      >
        <Link to="/auth/sign-in" className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4" strokeWidth={3} />
          Back to Sign In
        </Link>
      </Button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function SignUpPage() {
  const searchParams = new URLSearchParams(window.location.search)
  const inviteToken = searchParams.get('inviteToken') ?? undefined
  const emailFromInvite = searchParams.get('email') ?? undefined

  const [name, setName] = useState('')
  const [email, setEmail] = useState(emailFromInvite ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isFirstUser, setIsFirstUser] = useState(false)

  const navigate = useNavigate()

  const { hasAnyUser } = useAdminCheck()

  const signUpMutation = useSignUp({
    onSuccess: (firstUser) => {
      if (inviteToken) {
        navigate({ to: '/auth/accept-invite', search: { token: inviteToken } })
        return
      }
      setIsFirstUser(firstUser)
      setSuccess(true)
    },
  })

  const error = signUpMutation.error?.message ?? ''
  const loading = signUpMutation.isPending

  const passwordRequirements = useMemo(
    () => getPasswordRequirements(password),
    [password],
  )
  const allRequirementsMet = allPasswordRequirementsMet(passwordRequirements)
  const passwordsMatch = password === confirmPassword

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!allRequirementsMet || !passwordsMatch) return
    signUpMutation.mutate({ name, email, password })
  }

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
      {/* ── Left visual panel (lg+) ── */}
      <VisualPanel />

      {/* ── Right: form panel ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-10 sm:px-8 relative">
        <div className="w-full max-w-sm sm:max-w-md">
          {/* Mobile-only brand */}
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
            {/* Mobile stat pills */}
            <div className="flex items-center justify-center gap-3 mt-4">
              {STATS.map(({ value, label }) => (
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

          {/* Form card */}
          <div className="bg-[#161b22] rounded-2xl border border-[#21262d] shadow-[0_25px_60px_-15px_rgba(16,185,129,0.15)] relative overflow-hidden">
            {/* Top emerald line */}
            <div className="h-0.5 w-full bg-linear-to-r from-transparent via-emerald-500 to-transparent" />

            <div className="p-6 sm:p-8">
              {success ? (
                isFirstUser ? (
                  <SuccessAdmin />
                ) : (
                  <SuccessPending />
                )
              ) : (
                <>
                  {/* Form header */}
                  <div className="mb-7">
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {hasAnyUser ? 'Request access' : 'Create your account'}
                    </h2>
                    <p className="text-sm text-gray-400">
                      {hasAnyUser
                        ? 'An admin will approve your request'
                        : "You'll be the first admin — no approval needed"}
                    </p>
                  </div>

                  {/* First-user badge */}
                  {!hasAnyUser && (
                    <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-4 mb-6 flex items-start gap-3">
                      <Shield className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-emerald-300">
                        <strong className="text-emerald-200">
                          First user:
                        </strong>{' '}
                        You'll automatically become a super-admin and can
                        approve future users.
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400 mb-5">
                      {error}
                    </div>
                  )}

                  {inviteToken && emailFromInvite && (
                    <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                      <p className="text-emerald-300 font-medium mb-1">
                        You're accepting an invitation
                      </p>
                      <p className="text-gray-400 text-xs leading-relaxed">
                        Your account will be created with{' '}
                        <span className="text-emerald-400 font-mono">
                          {emailFromInvite}
                        </span>
                        . You must use this email — it's the address the invite
                        was sent to.
                      </p>
                      <p className="text-gray-400 text-xs leading-relaxed mt-2">
                        Fill in your name and password below, or use{' '}
                        <span className="text-white font-medium">
                          Sign up with Microsoft
                        </span>{' '}
                        at the bottom.
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-gray-300 text-sm">
                        Full name
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="bg-[#0d1117] border-[#21262d] text-white placeholder:text-gray-600 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300 h-11"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-gray-300 text-sm">
                        Work email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        readOnly={!!emailFromInvite}
                        className={`bg-[#0d1117] border-[#21262d] text-white placeholder:text-gray-600 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300 h-11 ${emailFromInvite ? 'cursor-not-allowed opacity-80' : ''}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="password"
                        className="text-gray-300 text-sm"
                      >
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="At least 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="pr-10 bg-[#0d1117] border-[#21262d] text-white placeholder:text-gray-600 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300 h-11"
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
                      {password && (
                        <div className="mt-2 space-y-1">
                          {passwordRequirements.map((req, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs"
                            >
                              <CheckCircle2
                                className={`w-3.5 h-3.5 transition-colors ${req.met ? 'text-emerald-400' : 'text-gray-600'}`}
                              />
                              <span
                                className={`transition-colors ${req.met ? 'text-emerald-400' : 'text-gray-500'}`}
                              >
                                {req.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="confirmPassword"
                        className="text-gray-300 text-sm"
                      >
                        Confirm password
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Re-enter your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="pr-10 bg-[#0d1117] border-[#21262d] text-white placeholder:text-gray-600 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300 h-11"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-400 transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {confirmPassword && !passwordsMatch && (
                        <p className="text-xs text-red-400 mt-1">
                          Passwords do not match
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={
                        loading || !allRequirementsMet || !passwordsMatch
                      }
                      className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0 mt-2"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 animate-spin" />
                          Creating account...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4" strokeWidth={3} />
                          {hasAnyUser
                            ? 'Request Access'
                            : 'Create Admin Account'}
                        </span>
                      )}
                    </Button>
                  </form>

                  {/* Divider */}
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

                  {/* Microsoft OAuth */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 border-[#21262d] bg-white dark:bg-white text-gray-900 dark:text-gray-900 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-gray-100 dark:hover:text-gray-900 font-medium transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_-8px_rgba(0,0,0,0.4)]"
                    onClick={() =>
                      authClient.signIn.social({
                        provider: 'microsoft',
                        callbackURL: inviteToken
                          ? `${window.location.origin}/auth/social-callback?inviteToken=${encodeURIComponent(inviteToken)}`
                          : `${window.location.origin}/auth/social-callback`,
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
                    Sign up with Microsoft
                  </Button>

                  {/* Footer links */}
                  <div className="mt-6 space-y-3">
                    <p className="text-center text-sm text-gray-400">
                      Already have an account?{' '}
                      <Link
                        to="/auth/sign-in"
                        className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                      >
                        Sign in
                      </Link>
                    </p>
                    <p className="text-center text-xs text-gray-600">
                      By signing up you agree to our{' '}
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
