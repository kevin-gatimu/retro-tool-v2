import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Bell, Loader2 } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { USER_PREFERENCES_ENDPOINTS } from '@/lib/api-endpoints'
import type { UserNotificationPreferences } from '@/common/types/user-preferences'
import { useUserPreferencesMutation } from './hooks/use-user-preferences-mutation'
import { SettingsSkeleton } from './skeleton'

const userPreferencesQueryOptions = {
  queryKey: ['user-preferences'] as const,
  queryFn: () =>
    api.get<UserNotificationPreferences>(USER_PREFERENCES_ENDPOINTS.BASE),
  staleTime: 60_000,
}

export const Route = createFileRoute('/profile/settings')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(userPreferencesQueryOptions),
  pendingComponent: SettingsSkeleton,
  component: SettingsPage,
})

function SettingsPage() {
  const { data: preferences } = useSuspenseQuery(userPreferencesQueryOptions)

  const updateMutation = useUserPreferencesMutation()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your application preferences
        </p>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {updateMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </CardTitle>
          <CardDescription>
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email verification reminders</Label>
              <p className="text-sm text-muted-foreground">
                Receive reminders to verify your email address
              </p>
            </div>
            <Switch
              checked={preferences.emailVerificationReminders}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ emailVerificationReminders: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
