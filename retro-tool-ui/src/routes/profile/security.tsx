import { createFileRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  Key,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Shield,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useChangePassword } from './hooks/use-change-password'
import { usePasskeys } from './hooks/use-passkeys'
import type { Passkey } from './hooks/use-passkeys'
import { SecuritySkeleton } from './skeleton'

/** WebAuthn is available only in secure contexts exposing the credentials API. */
const passkeysSupported =
  typeof window !== 'undefined' && !!window.PublicKeyCredential

export const Route = createFileRoute('/profile/security')({
  pendingComponent: SecuritySkeleton,
  component: SecurityPage,
})

const formatPasskeyDate = (value?: string | Date): string => {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Passkey management: list the user's passkeys and add / rename / delete them.
 * The WebAuthn ceremonies run in the browser via the auth client. `/profile/
 * security` is the hub for passwordless methods, so this section owns the
 * enabled/disabled state for passkeys.
 */
function PasskeysSection() {
  const { listQuery, addMutation, renameMutation, deleteMutation } =
    usePasskeys()
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameTarget, setRenameTarget] = useState<Passkey | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Passkey | null>(null)

  const passkeys = listQuery.data ?? []
  const enabled = passkeys.length > 0

  const handleAdd = (e: React.SyntheticEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    addMutation.mutate(name, {
      onSuccess: () => {
        setAddOpen(false)
        setNewName('')
      },
    })
  }

  const handleRename = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name) return
    renameMutation.mutate(
      { id: renameTarget.id, name },
      { onSuccess: () => setRenameTarget(null) },
    )
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Passkeys
              </h2>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  enabled
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Sign in without a password using biometrics or a security key.
            </p>
          </div>
        </div>
        {passkeysSupported && (
          <Button
            size="sm"
            onClick={() => {
              setNewName('')
              setAddOpen(true)
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Passkey
          </Button>
        )}
      </div>

      {!passkeysSupported ? (
        <div className="p-4 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
          This browser doesn&apos;t support passkeys. Try a modern browser on a
          device with biometric or security-key support.
        </div>
      ) : listQuery.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading passkeys…
        </div>
      ) : listQuery.isError ? (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <span className="text-destructive">
            {listQuery.error.message || 'Failed to load passkeys'}
          </span>
        </div>
      ) : passkeys.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          You don&apos;t have any passkeys yet. Add one to enable passwordless
          sign-in.
        </div>
      ) : (
        <div className="space-y-3">
          {passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {pk.name || 'Unnamed passkey'}
                  </h3>
                  {formatPasskeyDate(pk.createdAt) && (
                    <p className="text-sm text-muted-foreground">
                      Added {formatPasskeyDate(pk.createdAt)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Rename passkey"
                  onClick={() => {
                    setRenameTarget(pk)
                    setRenameValue(pk.name ?? '')
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete passkey"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(pk)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add passkey dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Add a passkey</DialogTitle>
              <DialogDescription>
                Give this passkey a name so you can recognize it later, then
                follow your browser&apos;s prompt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="passkey-name">Passkey name</Label>
              <Input
                id="passkey-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. MacBook Touch ID"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newName.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Waiting…
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename passkey dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Rename passkey</DialogTitle>
              <DialogDescription>
                Choose a new name for this passkey.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="passkey-rename">Passkey name</Label>
              <Input
                id="passkey-rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!renameValue.trim() || renameMutation.isPending}
              >
                {renameMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete passkey confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name
                ? `"${deleteTarget.name}" will no longer be able to sign in to your account.`
                : 'This passkey will no longer be able to sign in to your account.'}{' '}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing…
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SecurityPage() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const changePasswordMutation = useChangePassword({
    onSuccess: () => {
      setIsSaved(true)
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setTimeout(() => setIsSaved(false), 3000)
    },
    onError: (message) => setError(message),
  })

  const isLoading = changePasswordMutation.isPending

  const handlePasswordChange = (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError(null)

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
  }

  const securityFeatures = [
    {
      icon: Smartphone,
      title: 'Two-Factor Authentication',
      description:
        'Add an extra layer of security to your account by requiring a code from your phone.',
      status: 'disabled',
      action: 'Enable',
    },
    {
      icon: Lock,
      title: 'Login Notifications',
      description:
        'Get notified when someone logs into your account from a new device.',
      status: 'enabled',
      action: 'Manage',
    },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Security Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your password and security preferences to keep your account
          safe.
        </p>
      </div>

      {/* Password Change Form */}
      <form
        onSubmit={handlePasswordChange}
        className="bg-card rounded-xl border border-border p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Change Password
            </h2>
            <p className="text-sm text-muted-foreground">
              Update your password regularly to keep your account secure.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </div>
        )}

        {isSaved && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-green-600 dark:text-green-400">
              Password changed successfully!
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-foreground">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value,
                  })
                }
                placeholder="Enter current password"
                className="bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-foreground">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                placeholder="Enter new password"
                className="bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use at least 8 characters with a mix of letters, numbers, and
              symbols.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-foreground">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Confirm new password"
                className="bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </div>
      </form>

      {/* Passkeys */}
      <PasskeysSection />

      {/* Security Features */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Security Features
            </h2>
            <p className="text-sm text-muted-foreground">
              Enhance your account security with additional protection.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {securityFeatures.map((feature) => (
            <div
              key={feature.title}
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    feature.status === 'enabled'
                      ? 'bg-green-500/10'
                      : 'bg-muted'
                  }`}
                >
                  <feature.icon
                    className={`w-5 h-5 ${
                      feature.status === 'enabled'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">
                      {feature.title}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        feature.status === 'enabled'
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {feature.status === 'enabled' ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {feature.description}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                {feature.action}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Login Activity */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Recent Login Activity
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Review recent sign-in activity on your account.
        </p>
        <Button variant="outline">View Login History</Button>
      </div>
    </div>
  )
}
