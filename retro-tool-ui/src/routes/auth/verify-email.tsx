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
import { Label } from '@/components/ui/label'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { authClient } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { OTP_ENDPOINTS } from '@/lib/api-endpoints'

const searchSchema = z.object({
  email: z.string().optional(),
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
  const { email: emailFromSearch } = useSearch({ from: '/auth/verify-email' })
  const [email, setEmail] = useState<string | null>(emailFromSearch ?? null)
  const [otp, setOtp] = useState('')
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resendPending, setResendPending] = useState(false)

  // Resolve the email from the active session when not passed in the URL.
  useEffect(() => {
    if (email) return
    const getSession = async () => {
      const { data } = await authClient.getSession()
      if (data?.user.email) setEmail(data.user.email)
    }
    void getSession()
  }, [email])

  const otpComplete = otp.length === 6

  const handleVerify = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!email || !otpComplete) return
    setStatus('verifying')
    setError(null)
    try {
      await api.post(OTP_ENDPOINTS.VERIFY_EMAIL, { email, otp })
      setStatus('success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify email')
      setStatus('idle')
    }
  }

  const handleResend = async () => {
    if (!email) {
      toast.error('Enter your email or sign in to resend the code')
      return
    }
    setResendPending(true)
    try {
      await api.post(OTP_ENDPOINTS.SEND, {
        email,
        type: 'email-verification',
      })
      toast.success('Verification code sent — check your inbox')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Could not send the code',
      )
    } finally {
      setResendPending(false)
    }
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
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]"
          >
            <Link to="/auth/sign-in" search={{ status: 'pending' }}>
              Continue
            </Link>
          </Button>
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
        <h2 className="text-2xl font-bold text-white mb-2">
          Verify your email
        </h2>
        <p className="text-gray-400 text-sm">
          Enter the 6-digit code we sent
          {email ? (
            <>
              {' '}
              to <span className="text-emerald-400">{email}</span>
            </>
          ) : (
            ' to your email'
          )}
          .
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6">
        <div className="space-y-2 flex flex-col items-center">
          <Label className="text-gray-300 text-sm font-medium self-start">
            Verification code
          </Label>
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          type="submit"
          disabled={status === 'verifying' || !otpComplete}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
        >
          {status === 'verifying' ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </span>
          ) : (
            'Verify email'
          )}
        </Button>
      </form>

      <div className="mt-6 bg-[#0d1117] rounded-lg p-4 border border-gray-800">
        <p className="text-xs text-gray-400 text-center">
          Didn't receive the code? Check your spam folder or{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendPending}
            className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors disabled:opacity-50"
          >
            {resendPending ? 'sending…' : 'resend code'}
          </button>
          .
        </p>
      </div>

      <Link
        to="/auth/sign-in"
        className="mt-6 flex items-center justify-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors group text-sm"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to sign in
      </Link>
    </PageShell>
  )
}
