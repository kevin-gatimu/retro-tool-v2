import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, CheckCircle2, Loader2, Users } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { authClient } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { INVITATIONS_ENDPOINTS } from '@/lib/api-endpoints'
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
  type: 'org' | 'team'
  orgName: string
  teamName?: string
  role: string
  invitedEmail: string
  expired: boolean
  accepted: boolean
  isExistingUser: boolean
  orgId?: string
  teamId?: string
}

interface AcceptResponse {
  type: 'org' | 'team'
  organizationId: string
  teamId?: string
}

function AcceptInvitePage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const isAuthenticated = !!session?.user

  const previewQuery = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () =>
      api.get<InvitationPreview>(INVITATIONS_ENDPOINTS.PREVIEW(token!)),
    enabled: !!token,
    retry: false,
  })

  const acceptMutation = useMutation({
    mutationFn: () =>
      api.post<AcceptResponse>(INVITATIONS_ENDPOINTS.ACCEPT(token!)),
    onSuccess: (data) => {
      toast.success(
        data.type === 'team'
          ? 'You have joined the team'
          : 'You have joined the organisation',
      )
      if (data.type === 'team' && data.teamId) {
        navigate({ to: '/teams/$teamId', params: { teamId: data.teamId } })
      } else {
        navigate({
          to: '/organizations/$orgId',
          params: { orgId: data.organizationId },
        })
      }
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const renderContent = () => {
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
    const isTeam = preview.type === 'team'

    if (preview.accepted) {
      const destination = isTeam
        ? preview.teamId
          ? `/teams/${preview.teamId}`
          : '/teams'
        : preview.orgId
          ? `/organizations/${preview.orgId}`
          : '/organizations'

      return (
        <StateCard
          icon="success"
          title="Already Accepted"
          description={
            isTeam
              ? `This invitation to team ${preview.teamName} has already been accepted.`
              : `This invitation to ${preview.orgName} has already been accepted.`
          }
        >
          <Button
            asChild
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-8"
          >
            <Link to={destination}>
              {isTeam ? 'Go to Team' : 'Go to Organisation'}
            </Link>
          </Button>
        </StateCard>
      )
    }

    if (preview.expired) {
      return (
        <StateCard
          icon="error"
          title="Invitation Expired"
          description={`Your invitation has expired. Please ask an admin to send a new invite.`}
        />
      )
    }

    if (!isAuthenticated) {
      return <NotAuthenticatedView preview={preview} token={token} />
    }

    const sessionEmail = session.user.email.toLowerCase()
    const invitedEmail = preview.invitedEmail.toLowerCase()
    if (sessionEmail !== invitedEmail) {
      return (
        <EmailMismatchView
          preview={preview}
          token={token}
          currentEmail={session.user.email}
        />
      )
    }

    return (
      <InvitationDetails preview={preview}>
        {acceptMutation.error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {acceptMutation.error.message}
          </div>
        )}
        <Button
          onClick={() => acceptMutation.mutate()}
          disabled={acceptMutation.isPending}
          className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0"
        >
          {acceptMutation.isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Accepting...
            </span>
          ) : (
            'Accept Invitation'
          )}
        </Button>
      </InvitationDetails>
    )
  }

  return <PageShell>{renderContent()}</PageShell>
}

// ─── Shared shell (centered card) ─────────────────────────────────────────────

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

// ─── Sub-views ────────────────────────────────────────────────────────────────

function NotAuthenticatedView({
  preview,
  token,
}: {
  preview: InvitationPreview
  token: string
}) {
  const inviteSearch = { inviteToken: token, email: preview.invitedEmail }
  const isExisting = preview.isExistingUser

  const signUpButton = (
    <Button
      asChild
      className={
        isExisting
          ? 'w-full h-12 border border-[#21262d] bg-transparent text-gray-300 hover:bg-[#21262d]'
          : 'w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]'
      }
      variant={isExisting ? 'outline' : 'default'}
    >
      <Link to="/auth/sign-up" search={inviteSearch}>
        {isExisting ? 'Create a new account' : 'Create Account & Accept'}
      </Link>
    </Button>
  )

  const signInButton = (
    <Button
      asChild
      className={
        isExisting
          ? 'w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)]'
          : 'w-full h-12 border border-[#21262d] bg-transparent text-gray-300 hover:bg-[#21262d]'
      }
      variant={isExisting ? 'default' : 'outline'}
    >
      <Link to="/auth/sign-in" search={inviteSearch}>
        {isExisting ? 'Sign In & Accept' : 'I already have an account'}
      </Link>
    </Button>
  )

  return (
    <InvitationDetails preview={preview}>
      <div
        className={`mb-4 rounded-lg border p-3 text-left text-xs leading-relaxed ${
          isExisting
            ? 'border-emerald-500/30 bg-emerald-500/5 text-gray-300'
            : 'border-amber-500/30 bg-amber-500/5 text-gray-300'
        }`}
      >
        {isExisting ? (
          <>
            <p className="text-emerald-300 font-semibold mb-1">
              We found your account
            </p>
            An account already exists for{' '}
            <span className="text-emerald-400 font-mono">
              {preview.invitedEmail}
            </span>
            . Sign in to accept this invitation.
          </>
        ) : (
          <>
            <p className="text-amber-300 font-semibold mb-1">You're new here</p>
            No account exists yet for{' '}
            <span className="text-amber-300 font-mono">
              {preview.invitedEmail}
            </span>
            . Create your account using this email — it will be pre-filled and
            locked so the invite can be matched.
          </>
        )}
      </div>
      <div className="space-y-3">
        {isExisting ? signInButton : signUpButton}
        {isExisting ? signUpButton : signInButton}
      </div>
    </InvitationDetails>
  )
}

function EmailMismatchView({
  preview,
  token,
  currentEmail,
}: {
  preview: InvitationPreview
  token: string
  currentEmail: string
}) {
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const handleSwitchAccount = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
      navigate({
        to: '/auth/sign-in',
        search: { inviteToken: token, email: preview.invitedEmail },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign out')
      setSigningOut(false)
    }
  }

  return (
    <div className="relative text-center">
      <div className="relative mx-auto mb-6 w-fit">
        <div className="absolute inset-0 bg-amber-500/30 blur-2xl rounded-full scale-150" />
        <div className="relative w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
          <AlertCircle className="h-8 w-8 text-amber-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">
        Wrong Account Signed In
      </h2>
      <p className="text-gray-400 mb-6 text-sm">
        This invitation was sent to a different email address.
      </p>

      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 mb-6 text-left text-sm space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-gray-500 w-24 shrink-0">Signed in as:</span>
          <span className="text-white font-mono break-all">{currentEmail}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-gray-500 w-24 shrink-0">Invited:</span>
          <span className="text-emerald-400 font-mono break-all">
            {preview.invitedEmail}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-6">
        Sign out of your current account and continue with the invited email to
        accept this invitation.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          onClick={handleSwitchAccount}
          disabled={signingOut}
          className="h-11 px-6 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold disabled:opacity-50"
        >
          {signingOut ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing Out...
            </span>
          ) : (
            'Sign Out & Continue'
          )}
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-11 px-6 border-[#21262d] text-gray-300 hover:bg-[#21262d]"
        >
          <Link to="/dashboard">Cancel</Link>
        </Button>
      </div>
    </div>
  )
}

function InvitationDetails({
  preview,
  children,
}: {
  preview: InvitationPreview
  children: React.ReactNode
}) {
  const isTeam = preview.type === 'team'
  return (
    <div className="relative text-center">
      <div className="relative mx-auto mb-6 w-fit">
        <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full scale-150" />
        <div className="relative w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
          <Users className="h-8 w-8 text-emerald-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">
        {isTeam ? 'Join Team' : 'Join Organisation'}
      </h2>
      <p className="text-gray-400 mb-1">You've been invited to join</p>
      <p className="text-emerald-400 font-semibold text-lg mb-1">
        {preview.orgName}
      </p>
      {isTeam && preview.teamName && (
        <p className="text-emerald-300 font-medium mb-1">
          Team: {preview.teamName}
        </p>
      )}
      <p className="text-gray-500 text-sm mb-8">
        as <span className="capitalize">{preview.role}</span>
      </p>
      {children}
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
