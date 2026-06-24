import { createFileRoute, Link, useSearch } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  allPasswordRequirementsMet,
  getPasswordRequirements,
  passwordsMatch,
} from './helpers'
import { useResendResetOtp, useResetPassword } from './hooks'

const searchSchema = z.object({
  email: z.string().optional(),
})

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { email } = useSearch({ from: '/auth/reset-password' })
  const [otp, setOtp] = useState('')
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [resentNote, setResentNote] = useState(false)

  const passwordRequirements = useMemo(
    () => getPasswordRequirements(formData.password),
    [formData.password],
  )

  const allRequirementsMet = allPasswordRequirementsMet(passwordRequirements)
  const passwordsMatchValue = useMemo(
    () => passwordsMatch(formData.password, formData.confirmPassword),
    [formData.password, formData.confirmPassword],
  )
  const otpComplete = otp.length === 6

  const resetPasswordMutation = useResetPassword({
    onSuccess: () => setIsSuccess(true),
  })
  const resendMutation = useResendResetOtp()

  const isLoading = resetPasswordMutation.isPending
  const error = resetPasswordMutation.error?.message ?? null

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!email || !otpComplete || !allRequirementsMet || !passwordsMatchValue)
      return
    resetPasswordMutation.mutate({ email, otp, password: formData.password })
  }

  // No email in the URL → the user landed here directly; send them back.
  if (!email) {
    return (
      <PageShell>
        <div className="relative text-center">
          <div className="relative mx-auto mb-6 w-fit">
            <div className="absolute inset-0 bg-red-500/30 blur-2xl rounded-full scale-150" />
            <div className="relative w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Start a password reset
          </h2>
          <p className="text-gray-400 mb-8">
            Request a reset code to continue.
          </p>
          <div className="w-full space-y-3">
            <Button
              asChild
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
            >
              <Link to="/auth/forgot-password">Request a reset code</Link>
            </Button>
            <Link
              to="/auth/sign-in"
              className="flex items-center justify-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors group py-2"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to sign in
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  if (isSuccess) {
    return (
      <PageShell>
        <div className="relative text-center">
          <div className="relative mx-auto mb-6 w-fit">
            <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
            <div className="relative w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Password reset!
          </h2>
          <p className="text-gray-400 mb-8">
            Your password has been reset. You can now sign in with your new
            password.
          </p>
          <Button
            asChild
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
          >
            <Link to="/auth/sign-in">Sign in</Link>
          </Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="relative">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
              <div className="relative p-3 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-xl border border-emerald-500/20">
                <Lock className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Set new password
          </h1>
          <p className="text-gray-400">
            Enter the 6-digit code sent to{' '}
            <span className="text-emerald-400">{email}</span> and choose a new
            password.
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
            <Label className="text-gray-300 text-sm font-medium">
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
            <div className="text-sm text-gray-500">
              Didn't get it?{' '}
              <button
                type="button"
                onClick={() => {
                  resendMutation.mutate(email, {
                    onSuccess: () => setResentNote(true),
                  })
                }}
                disabled={resendMutation.isPending}
                className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors disabled:opacity-50"
              >
                Resend code
              </button>
              {resentNote && (
                <span className="ml-2 text-emerald-400">Code sent.</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-gray-300 text-sm font-medium"
            >
              New Password
            </Label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="pl-10 pr-10 h-12 bg-[#0d1117] border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20 focus:ring-2 transition-all duration-300"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-400 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {formData.password && (
              <div className="mt-3 space-y-1.5">
                {passwordRequirements.map((req, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2
                      className={`w-4 h-4 transition-colors ${req.met ? 'text-emerald-400' : 'text-gray-600'}`}
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

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-gray-300 text-sm font-medium"
            >
              Confirm Password
            </Label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className="pl-10 pr-10 h-12 bg-[#0d1117] border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20 focus:ring-2 transition-all duration-300"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-400 transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {formData.confirmPassword && (
              <div className="flex items-center gap-2 text-sm mt-2">
                <CheckCircle2
                  className={`w-4 h-4 transition-colors ${passwordsMatchValue ? 'text-emerald-400' : 'text-gray-600'}`}
                />
                <span
                  className={`transition-colors ${passwordsMatchValue ? 'text-emerald-400' : 'text-gray-500'}`}
                >
                  Passwords match
                </span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={
              isLoading ||
              !otpComplete ||
              !allRequirementsMet ||
              !passwordsMatchValue
            }
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Resetting...
              </span>
            ) : (
              'Reset Password'
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
