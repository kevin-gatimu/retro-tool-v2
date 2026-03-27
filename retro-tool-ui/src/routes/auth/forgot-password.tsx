import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DetailPageSkeleton } from '@/components/skeletons'
import { useForgotPassword } from './hooks'

export const Route = createFileRoute('/auth/forgot-password')({
  pendingComponent: DetailPageSkeleton,
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  const forgotPasswordMutation = useForgotPassword({
    onSuccess: () => setIsSubmitted(true),
  })

  const isLoading = forgotPasswordMutation.isPending
  const error = forgotPasswordMutation.error?.message ?? null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    forgotPasswordMutation.mutate(email)
  }

  if (isSubmitted) {
    return (
      <div className="relative text-center">
        <div className="relative mx-auto mb-6 w-fit">
          <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
          <div
            className="relative w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center
						border border-emerald-500/30"
          >
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
        <p className="text-gray-400 mb-2">
          We've sent a password reset link to
        </p>
        <p className="text-emerald-400 font-medium mb-8">{email}</p>

        <div className="w-full bg-[#0d1117] rounded-lg p-4 border border-gray-800 mb-6">
          <p className="text-sm text-gray-400">
            Didn't receive the email? Check your spam folder or{' '}
            <button
              type="button"
              onClick={() => setIsSubmitted(false)}
              className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
            >
              try another email
            </button>
          </p>
        </div>

        <Link
          to="/auth/sign-in"
          className="flex items-center justify-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
            <div className="relative p-3 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-xl border border-emerald-500/20">
              <Sparkles className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Forgot password?</h1>
        <p className="text-gray-400">
          No worries, we'll send you reset instructions.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-300 text-sm font-medium">
            Email
          </Label>
          <div className="relative group">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500
							group-focus-within:text-emerald-400 transition-colors"
            />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 bg-[#0d1117] border-gray-700 text-white placeholder:text-gray-500
								focus:border-emerald-500 focus:ring-emerald-500/20 focus:ring-2
								transition-all duration-300"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold
						transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
						hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]
						disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </span>
          ) : (
            'Send Reset Link'
          )}
        </Button>
      </form>

      <div className="mt-8 text-center">
        <Link
          to="/auth/sign-in"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
