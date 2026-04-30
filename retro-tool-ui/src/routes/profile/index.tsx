import { createFileRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUpdateProfile } from './hooks/useUpdateProfile'
import type { UserData } from './types'
import { getInitials } from './helpers'
import { Skeleton } from '@/components/ui/skeleton'

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-card rounded-xl border p-6 space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="pt-4 border-t">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-2 gap-4 mt-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="bg-card rounded-xl border border-destructive/20 p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/profile/')({
  pendingComponent: ProfileSkeleton,
  component: ProfilePage,
})

function ProfilePage() {
  const { data: session } = authClient.useSession()
  const [user, setUser] = useState<UserData | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '' })

  const { data: userData, isLoading: isUserLoading } = useCurrentUser()

  useEffect(() => {
    if (userData) {
      setUser(userData)
      setFormData({ name: userData.name })
    }
  }, [userData])

  const updateProfileMutation = useUpdateProfile({
    onSuccess: () => {
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 3000)
    },
    onError: (message) => setError(message),
  })

  const isLoading = updateProfileMutation.isPending

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError(null)
    updateProfileMutation.mutate(formData.name)
  }

  if (isUserLoading && !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Not logged in</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal information and account details.
        </p>
      </div>

      {/* Avatar Section */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Profile Photo
        </h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            {session?.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-24 h-24 rounded-full object-cover border-4 border-primary/20"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-linear-to-br from-primary to-primary/60 flex items-center justify-center text-white text-2xl font-bold border-4 border-primary/20">
                {getInitials(user.name || 'U')}
              </div>
            )}
            <button
              type="button"
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white shadow-lg hover:bg-primary/90 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div>
            <p className="text-foreground font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a new photo
            </p>
            <p className="text-sm text-muted-foreground">
              JPG, PNG or GIF. Max size 2MB.
            </p>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm">
                Upload Photo
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-xl border border-border p-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-6">
          Personal Information
        </h2>

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
              Changes saved!
            </span>
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="flex items-center gap-2 text-foreground"
            >
              <User className="w-4 h-4 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter your full name"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="flex items-center gap-2 text-foreground"
            >
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-sm text-muted-foreground">
              Email address cannot be changed. Contact support if you need
              assistance.
            </p>
          </div>

          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Account Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Account ID</span>
                <p className="text-foreground font-mono mt-1">
                  {user.id.slice(0, 8)}...
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Member Since</span>
                <p className="text-foreground mt-1">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-border">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="bg-card rounded-xl border border-destructive/20 p-6">
        <h2 className="text-lg font-semibold text-destructive mb-2">
          Danger Zone
        </h2>
        <p className="text-muted-foreground mb-4">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        <Button
          variant="outline"
          className="border-destructive/50 text-destructive hover:bg-destructive/10"
        >
          Delete Account
        </Button>
      </div>
    </div>
  )
}
