import { createFileRoute, Link, useSearch } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

const searchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/auth/verify-email')({
  validateSearch: searchSchema,
  component: VerifyEmailPage,
})

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-10 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md relative">
        <div className="bg-[#161b22] rounded-2xl border border-[#21262d] shadow-[0_25px_60px_-15px_rgba(16,185,129,0.15)] relative overflow-hidden">
          <div className="h-0.5 w-full bg-linear-to-r from-transparent via-emerald-500 to-transparent" />
          <div className="p-8 sm:p-10">{children}</div>
        </div>
      </div>
    </div>
  )
}

function VerifyEmailPage() {
  const { token } = useSearch({ from: '/auth/verify-email' })
  const [status, setStatus] = useState<
    'loading' | 'success' | 'error' | 'no-token'
  >(() => (token ? 'loading' : 'no-token'))
  const [error, setError] = useState<string | null>(null)
  const [resendPending, setResendPending] = useState(false)
  const [session, setSession] = useState<{ user: { email: string } } | null>(
    null,
  )

  useEffect(() => {
    const getSession = async () => {
      const { data } = await authClient.getSession()
      if (data) {
        setSession(data)
      }
    }
    getSession()
  }, [])

  useEffect(() => {
    if (!token) return

    const verifyEmail = async () => {
      try {
        await authClient.verifyEmail({ query: { token } })
        setStatus('success')
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to verify email'
        setError(message)
        setStatus('error')
      }
    }

    verifyEmail()
  }, [token])

  const handleResendVerification = async () => {
    if (!session?.user.email) {
      toast.error('Please sign in to resend verification email')
      return
    }

    setResendPending(true)
    try {
      await authClient.sendVerificationEmail({
        email: session.user.email,
        callbackURL: '/auth/verify-email',
      })
      toast.success('Verification email sent — check your inbox')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not send verification email'
      toast.error(message)
    } finally {
      setResendPending(false)
    }
  }

  if (status === 'loading') {
    return (
      <PageShell>
        <div className="text-center">
          <div className="relative mx-auto mb-6 w-fit">
            <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150 animate-pulse" />
            <div className="relative w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Verifying your email
          </h2>
          <p className="text-gray-400 text-sm">
            Please wait while we verify your email address...
          </p>
        </div>
      </PageShell>
    )
  }

  if (status === 'success') {
    return (
      <PageShell>
        <div className="text-center">
          <div className="relative mx-auto mb-6 w-fit">
            <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
            <div className="relative w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Email Verified!
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Your email has been successfully verified.
          </p>
          <div className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p className="text-amber-300 text-sm font-medium">
              Your account is now awaiting administrator approval.
            </p>
          </div>
          <Button
            asChild
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold
              transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
              hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]"
          >
            <Link to="/auth/sign-in" search={{ status: 'pending' }}>
              Continue
            </Link>
          </Button>
        </div>
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell>
        <div className="text-center">
          <div className="relative mx-auto mb-6 w-fit">
            <div className="absolute inset-0 bg-red-500/30 blur-2xl rounded-full scale-150" />
            <div className="relative w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Verification Failed
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            {error ||
              "We couldn't verify your email. The link may have expired."}
          </p>
          <div className="w-full space-y-3">
            {session?.user.email ? (
              <Button
                onClick={handleResendVerification}
                disabled={resendPending}
                className="w-full h-12 bg-transparent border border-red-500/50 text-red-400 font-semibold
                  hover:bg-red-500/10 transition-all duration-300 hover:scale-[1.02]"
              >
                {resendPending ? 'Sending...' : 'Resend Verification Email'}
              </Button>
            ) : null}
            <Link
              to="/auth/sign-in"
              className="flex items-center justify-center gap-2 text-gray-400 hover:text-emerald-400
                transition-colors group py-2"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to sign in
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
            <div className="relative p-3 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-xl border border-emerald-500/20">
              <Mail className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
        <p className="text-gray-400 text-sm">
          We've sent a verification link to your email address. Please click the
          link to verify your account.
        </p>
      </div>

      <div className="bg-[#0d1117] rounded-lg p-4 border border-gray-800 mb-6">
        <p className="text-xs text-gray-400 text-center">
          Didn't receive the email? Check your spam folder or request a new
          verification email from your profile settings.
        </p>
      </div>

      <Link
        to="/auth/sign-in"
        className="flex items-center justify-center gap-2 text-gray-400 hover:text-emerald-400
          transition-colors group text-sm"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to sign in
      </Link>
    </PageShell>
  )
}
