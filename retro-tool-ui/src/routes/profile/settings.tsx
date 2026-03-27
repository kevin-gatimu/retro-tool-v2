import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Bell, Loader2, Settings } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SettingsSkeleton } from '@/components/skeletons'
import { api } from '@/lib/api'
import { USER_PREFERENCES_ENDPOINTS } from '@/lib/api-endpoints'
import type { UserNotificationPreferences } from '@/common/types/user-preferences'
import { useUserPreferencesMutation } from './hooks/useUserPreferencesMutation'

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
              <Label>Team activity emails</Label>
              <p className="text-sm text-muted-foreground">
                Receive email updates about team activity
              </p>
            </div>
            <Switch
              checked={preferences.teamActivityEmailsEnabled}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ teamActivityEmailsEnabled: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Retrospective reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get reminded about upcoming retrospectives
              </p>
            </div>
            <Switch
              checked={preferences.retrospectiveRemindersEnabled}
              onCheckedChange={(checked) =>
                updateMutation.mutate({
                  retrospectiveRemindersEnabled: checked,
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly digest</Label>
              <p className="text-sm text-muted-foreground">
                Receive a weekly summary of team activities
              </p>
            </div>
            <Switch
              checked={preferences.weeklyDigestEnabled}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ weeklyDigestEnabled: checked })
              }
            />
          </div>
          {preferences.weeklyDigestEnabled && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Digest day</Label>
                <p className="text-sm text-muted-foreground">
                  Day of the week to receive the digest
                </p>
              </div>
              <Select
                value={preferences.weeklyDigestDay}
                onValueChange={(value) =>
                  updateMutation.mutate({
                    weeklyDigestDay:
                      value as typeof preferences.weeklyDigestDay,
                  })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="tuesday">Tuesday</SelectItem>
                  <SelectItem value="wednesday">Wednesday</SelectItem>
                  <SelectItem value="thursday">Thursday</SelectItem>
                  <SelectItem value="friday">Friday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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

      {/* Reminder Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Reminder Timing
          </CardTitle>
          <CardDescription>Control when you receive reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Retrospective reminder lead time</Label>
              <p className="text-sm text-muted-foreground">
                How many hours before a retro to send a reminder
              </p>
            </div>
            <Select
              value={String(preferences.retrospectiveReminderHours)}
              onValueChange={(value) =>
                updateMutation.mutate({
                  retrospectiveReminderHours: Number(value),
                })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="2">2 hours</SelectItem>
                <SelectItem value="4">4 hours</SelectItem>
                <SelectItem value="12">12 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="48">48 hours</SelectItem>
                <SelectItem value="72">72 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
