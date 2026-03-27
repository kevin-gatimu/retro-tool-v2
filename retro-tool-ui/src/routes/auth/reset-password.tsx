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
  allPasswordRequirementsMet,
  getPasswordRequirements,
  passwordsMatch,
} from './helpers'
import { useResetPassword } from './hooks'

const searchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = useSearch({ from: '/auth/reset-password' })
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const passwordRequirements = useMemo(
    () => getPasswordRequirements(formData.password),
    [formData.password],
  )

  const allRequirementsMet = allPasswordRequirementsMet(passwordRequirements)
  const passwordsMatchValue = useMemo(
    () => passwordsMatch(formData.password, formData.confirmPassword),
    [formData.password, formData.confirmPassword],
  )

  const resetPasswordMutation = useResetPassword({
    onSuccess: () => setIsSuccess(true),
  })

  const isLoading = resetPasswordMutation.isPending
  const error = resetPasswordMutation.error?.message ?? null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !allRequirementsMet || !passwordsMatchValue) return
    resetPasswordMutation.mutate({ token, password: formData.password })
  }

  if (!token) {
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
        <h2 className="text-2xl font-bold text-white mb-2">Invalid Link</h2>
        <p className="text-gray-400 mb-8">
          This password reset link is invalid or has expired.
        </p>
        <div className="w-full space-y-3">
          <Button
            asChild
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold
							transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
							hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]"
          >
            <Link to="/auth/forgot-password">Request New Reset Link</Link>
          </Button>
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

  if (isSuccess) {
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
        <h2 className="text-2xl font-bold text-white mb-2">Password Reset!</h2>
        <p className="text-gray-400 mb-8">
          Your password has been successfully reset. You can now sign in with
          your new password.
        </p>
        <Button
          asChild
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold
						transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
						hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]"
        >
          <Link to="/auth/sign-in">Sign In</Link>
        </Button>
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
              <Lock className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Set new password</h1>
        <p className="text-gray-400">
          Your new password must be different from previously used passwords.
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
          disabled={isLoading || !allRequirementsMet || !passwordsMatchValue}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold
						transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
						hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]
						disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
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
  )
}
