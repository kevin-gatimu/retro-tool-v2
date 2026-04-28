import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, CheckCircle2, Loader2, Users } from 'lucide-react'
import { z } from 'zod'
import { authClient } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const searchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/auth/accept-invite')({
  validateSearch: searchSchema,
  component: AcceptInvitePage,
})

interface InvitationPreview {
  orgName: string
  role: string
  expired: boolean
  accepted: boolean
}

function AcceptInvitePage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const isAuthenticated = !!session?.user

  const previewQuery = useQuery({
    queryKey: ['org-invitation-preview', token],
    queryFn: () =>
      api.get<InvitationPreview>(
        ORGANIZATIONS_ENDPOINTS.INVITATION_PREVIEW(token!),
      ),
    enabled: !!token,
    retry: false,
  })

  const acceptMutation = useMutation({
    mutationFn: () =>
      api.post(ORGANIZATIONS_ENDPOINTS.INVITATION_ACCEPT(token!)),
    onSuccess: () => {
      toast.success('You have joined the organisation')
      navigate({ to: '/organizations' })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  if (!token) {
    return (
      <StateCard
        icon="error"
        title="Invalid Link"
        description="This invitation link is missing a token. Please check the link and try again."
      />
    )
  }

  if (previewQuery.isLoading || sessionPending) {
    return (
      <div className="flex justify-center items-center min-h-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (previewQuery.isError) {
    return (
      <StateCard
        icon="error"
        title="Invitation Not Found"
        description="This invitation link is invalid or has been removed."
      />
    )
  }

  const preview = previewQuery.data!

  if (preview.accepted) {
    return (
      <StateCard
        icon="success"
        title="Already Accepted"
        description={`This invitation to ${preview.orgName} has already been accepted.`}
      >
        <Button
          asChild
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
        >
          <Link to="/organizations">Go to Organisations</Link>
        </Button>
      </StateCard>
    )
  }

  if (preview.expired) {
    return (
      <StateCard
        icon="error"
        title="Invitation Expired"
        description={`Your invitation to join ${preview.orgName} has expired. Please ask an admin to send a new invite.`}
      />
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="relative text-center">
        <div className="relative mx-auto mb-6 w-fit">
          <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
          <div className="relative w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <Users className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">You're Invited!</h2>
        <p className="text-gray-400 mb-1">You've been invited to join</p>
        <p className="text-emerald-400 font-semibold text-lg mb-1">
          {preview.orgName}
        </p>
        <p className="text-gray-500 text-sm mb-8">
          as <span className="capitalize">{preview.role}</span>
        </p>
        <div className="space-y-3">
          <Button
            asChild
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]"
          >
            <Link to="/auth/sign-up" search={{ inviteToken: token }}>
              Create Account
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full h-12 border-[#21262d] text-gray-300 hover:bg-[#21262d]"
          >
            <Link to="/auth/sign-in" search={{ inviteToken: token }}>
              Sign In to Existing Account
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative text-center">
      <div className="relative mx-auto mb-6 w-fit">
        <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
        <div className="relative w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
          <Users className="h-8 w-8 text-emerald-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Join Organisation</h2>
      <p className="text-gray-400 mb-1">You've been invited to join</p>
      <p className="text-emerald-400 font-semibold text-lg mb-1">
        {preview.orgName}
      </p>
      <p className="text-gray-500 text-sm mb-8">
        as <span className="capitalize">{preview.role}</span>
      </p>
      {acceptMutation.error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {acceptMutation.error.message}
        </div>
      )}
      <Button
        onClick={() => acceptMutation.mutate()}
        disabled={acceptMutation.isPending}
        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0"
      >
        {acceptMutation.isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Accepting...
          </span>
        ) : (
          `Accept Invitation`
        )}
      </Button>
    </div>
  )
}

function StateCard({
  icon,
  title,
  description,
  children,
}: {
  icon: 'error' | 'success'
  title: string
  description: string
  children?: React.ReactNode
}) {
  const isError = icon === 'error'
  return (
    <div className="relative text-center">
      <div className="relative mx-auto mb-6 w-fit">
        <div
          className={`absolute inset-0 ${isError ? 'bg-red-500/30' : 'bg-emerald-500/30'} blur-2xl rounded-full scale-150`}
        />
        <div
          className={`relative w-16 h-16 rounded-full ${isError ? 'bg-red-500/20 border-red-500/30' : 'bg-emerald-500/20 border-emerald-500/30'} flex items-center justify-center border`}
        >
          {isError ? (
            <AlertCircle className="h-8 w-8 text-red-400" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          )}
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-gray-400 mb-8">{description}</p>
      {children}
    </div>
  )
}
