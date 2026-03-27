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
    // Get the current session to check if user is signed in
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
      <div className="relative text-center">
        <div className="relative mx-auto mb-6 w-fit">
          <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150 animate-pulse" />
          <div
            className="relative w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center
						border border-emerald-500/30"
          >
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Verifying your email
        </h2>
        <p className="text-gray-400">
          Please wait while we verify your email address...
        </p>
      </div>
    )
  }

  if (status === 'success') {
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
        <h2 className="text-2xl font-bold text-white mb-2">Email Verified!</h2>
        <p className="text-gray-400 mb-8">
          Your email has been successfully verified. You can now access all
          features.
        </p>
        <Button
          asChild
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold
						transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
						hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]"
        >
          <Link to="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="relative text-center">
        <div className="relative mx-auto mb-6 w-fit">
          <div className="absolute inset-0 bg-red-500/30 blur-2xl rounded-full scale-150" />
          <div
            className="relative w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center
						border border-red-500/30"
          >
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Verification Failed
        </h2>
        <p className="text-gray-400 mb-8">
          {error || "We couldn't verify your email. The link may have expired."}
        </p>
        <div className="w-full space-y-3">
          {session?.user.email ? (
            <Button
              onClick={handleResendVerification}
              disabled={resendPending}
              className="w-full h-12 bg-transparent border border-red-500 text-red-400 font-semibold
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
    )
  }

  return (
    <div className="relative">
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
        <p className="text-gray-400">
          We've sent a verification link to your email address. Please click the
          link to verify your account.
        </p>
      </div>

      <div className="bg-[#0d1117] rounded-lg p-4 border border-gray-800 mb-6">
        <p className="text-sm text-gray-400 text-center">
          Didn't receive the email? Check your spam folder or request a new
          verification email from your profile settings.
        </p>
      </div>

      <Link
        to="/auth/sign-in"
        className="flex items-center justify-center gap-2 text-gray-400 hover:text-emerald-400
					transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to sign in
      </Link>
    </div>
  )
}
