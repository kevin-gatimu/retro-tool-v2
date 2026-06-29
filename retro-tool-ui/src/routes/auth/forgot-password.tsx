import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Mail,
  Send,
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
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  const forgotPasswordMutation = useForgotPassword({
    // Send the reset OTP, then move to the reset screen carrying the email.
    onSuccess: (submittedEmail) =>
      navigate({
        to: '/auth/reset-password',
        search: { email: submittedEmail },
      }),
  })

  const isLoading = forgotPasswordMutation.isPending
  const error = forgotPasswordMutation.error?.message ?? null

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    forgotPasswordMutation.mutate(email)
  }

  return (
    <PageShell>
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
          <h1 className="text-2xl font-bold text-white mb-2">
            Forgot password?
          </h1>
          <p className="text-gray-400">
            Enter your email and we'll send you a 6-digit reset code.
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
            <Label
              htmlFor="email"
              className="text-gray-300 text-sm font-medium"
            >
              Email
            </Label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 bg-[#0d1117] border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20 focus:ring-2 transition-all duration-300"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send reset code
              </span>
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
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-56px)] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-10 sm:px-8 relative">
        <div className="w-full max-w-md">
          <div className="bg-[#161b22] rounded-2xl border border-[#21262d] shadow-[0_25px_60px_-15px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="h-0.5 w-full bg-linear-to-r from-transparent via-emerald-500 to-transparent" />
            <div className="p-6 sm:p-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
