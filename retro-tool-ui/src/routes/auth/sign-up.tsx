import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ChevronRight,
  Clock,
  Crown,
  Eye,
  EyeOff,
  Sparkles,
  Shield,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DetailPageSkeleton } from '@/components/skeletons'
import { authClient } from '@/lib/auth-client'
import { useAdminCheck, useSignUp } from './hooks'

export const Route = createFileRoute('/auth/sign-up')({
  pendingComponent: DetailPageSkeleton,
  component: SignUpPage,
})

function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isFirstUser, setIsFirstUser] = useState(false)

  const { hasAnyUser } = useAdminCheck()

  const signUpMutation = useSignUp({
    onSuccess: (firstUser) => {
      setIsFirstUser(firstUser)
      setSuccess(true)
    },
  })

  const error = signUpMutation.error?.message ?? ''
  const loading = signUpMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    signUpMutation.mutate({ name, email, password })
  }

  if (success) {
    return (
      <div className="relative text-center">
        {isFirstUser ? (
          <>
            <div className="relative mx-auto mb-6 w-fit">
              <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
              <div
                className="relative p-4 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full
								border border-emerald-500/30 animate-pulse"
              >
                <Crown className="h-12 w-12 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Welcome, Admin!
            </h2>
            <p className="text-gray-400 mb-8">
              You're the first user, so you've been automatically made an
              administrator. Sign in to access your dashboard.
            </p>
            <Button
              asChild
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold
								transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
								hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]"
            >
              <Link to="/auth/sign-in" className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" strokeWidth={3} />
                Sign In
              </Link>
            </Button>
          </>
        ) : (
          <>
            <div className="relative mx-auto mb-6 w-fit">
              <div className="absolute inset-0 bg-amber-500/30 blur-2xl rounded-full scale-150" />
              <div
                className="relative p-4 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full
								border border-amber-500/30 animate-pulse"
              >
                <Clock className="h-12 w-12 text-amber-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Account Pending Approval
            </h2>
            <p className="text-gray-400 mb-8">
              Your account has been created successfully. An administrator will
              review and approve your account. You'll be able to sign in once
              approved.
            </p>
            <Button
              asChild
              className="bg-transparent border border-emerald-500 text-emerald-400 font-semibold
								hover:bg-emerald-500/10 transition-all duration-300 hover:scale-[1.02]"
            >
              <Link to="/auth/sign-in" className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" strokeWidth={3} />
                Back to Sign In
              </Link>
            </Button>
          </>
        )}
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
        <h2 className="text-xl font-semibold text-white mb-2">
          Create an account
        </h2>
        <p className="text-gray-400 text-sm">
          {hasAnyUser
            ? 'Enter your details to request access'
            : "You'll be the first admin!"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!hasAnyUser && (
          <div
            className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-400
						flex items-start gap-3"
          >
            <Shield className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-300">First user:</strong> You will
              automatically become an administrator and can approve future
              users.
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-gray-300">
            Name
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-[#0d1117] border-gray-700 text-white placeholder:text-gray-500
							focus:border-emerald-500 focus:ring-emerald-500/20
							transition-all duration-300"
          />
        </div>

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
          <Label htmlFor="password" className="text-gray-300">
            Password
          </Label>
          <div className="relative group">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold
						transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
						hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]
						disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin" />
              Creating account...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4" strokeWidth={3} />
              {hasAnyUser ? 'Request Access' : 'Create Admin Account'}
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

      {/* Microsoft Sign Up */}
      <Button
        type="button"
        variant="outline"
        className="w-full border-gray-200 bg-white text-gray-900 hover:text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200
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
        Sign up with Microsoft
      </Button>

      <div className="mt-6 text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link
          to="/auth/sign-in"
          className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  )
}
