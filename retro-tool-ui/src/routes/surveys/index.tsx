import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ClipboardList, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SurveyCard } from '@/components/surveys/survey-card'
import { CreateSurveyDialog } from '@/components/surveys/create-survey-dialog'
import type { SurveyDialogOrg } from '@/components/surveys/create-survey-dialog'
import { useSurveyMutations } from '@/hooks/use-survey-mutations'
import { SurveyListConvexSync } from '@/routes/surveys/components/survey-list-convex-sync'
import { usesConvexForSurveys } from '@/lib/realtime-config'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  SURVEYS_ENDPOINTS,
  TEAMS_ENDPOINTS,
  USERS_ENDPOINTS,
} from '@/lib/api-endpoints'
import type { SurveyDetail, SurveySummary } from '@/common/types/surveys'
import type { Team } from '@/common/types/teams'
import type { Organization } from '@/common/types/organizations'
import type { User } from '@/common/types/users'

export const Route = createFileRoute('/surveys/')({
  component: SurveysIndexPage,
})

function SurveysIndexPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null)

  const convexRealtime = usesConvexForSurveys()

  const { data: surveys, isLoading } = useQuery({
    queryKey: ['surveys'],
    queryFn: () => api.get<SurveySummary[]>(SURVEYS_ENDPOINTS.LIST),
    staleTime: 15_000,
    refetchInterval: convexRealtime ? false : 15_000,
  })

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
    staleTime: 60_000,
  })

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () =>
      api.get<{ organizations: Organization[] }>(ORGANIZATIONS_ENDPOINTS.LIST),
    staleTime: 60_000,
  })

  const { data: currentUser } = useQuery({
    queryKey: ['sidebar-user'],
    queryFn: () => api.get<User>(USERS_ENDPOINTS.ME),
    staleTime: 60_000,
  })

  // Full detail (with questions) for the survey being edited.
  const { data: editingSurvey } = useQuery({
    queryKey: ['survey', editingSurveyId],
    queryFn: () =>
      api.get<SurveyDetail>(SURVEYS_ENDPOINTS.BY_ID(editingSurveyId!)),
    enabled: Boolean(editingSurveyId),
  })

  const {
    createSurveyMutation,
    updateSurveyMutation,
    setClosedMutation,
    deleteSurveyMutation,
  } = useSurveyMutations(() => {
    void queryClient.refetchQueries({ queryKey: ['surveys'] })
  })

  const teams = teamsData?.teams ?? []
  const organizations: SurveyDialogOrg[] = orgsData?.organizations ?? []

  if (isLoading) {
    return (
      <div className="space-y-6">
        {convexRealtime ? <SurveyListConvexSync /> : null}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {convexRealtime ? <SurveyListConvexSync /> : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <ClipboardList className="h-8 w-8 text-primary" />
            Surveys
          </h1>
          <p className="text-muted-foreground">
            Collect structured feedback from your team, org, or everyone
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={teams.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Survey
        </Button>
      </div>

      {!surveys || surveys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 rounded-full bg-primary/10 p-4">
              <ClipboardList className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mb-2">No surveys yet</CardTitle>
            <CardDescription className="max-w-sm text-center">
              Create a survey to gather structured feedback with rating, choice,
              and free-text questions.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {surveys.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onSetClosed={(surveyId, isClosed) =>
                setClosedMutation.mutate({ surveyId, isClosed })
              }
              onDelete={(surveyId) => deleteSurveyMutation.mutate(surveyId)}
              onEdit={(surveyId) => setEditingSurveyId(surveyId)}
            />
          ))}
        </div>
      )}

      {teams.length > 0 && (
        <CreateSurveyDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          teams={teams}
          organizations={organizations}
          currentUserRole={currentUser?.role}
          onCreate={(data) =>
            createSurveyMutation.mutate(data, {
              onSuccess: () => setCreateOpen(false),
            })
          }
          isCreating={createSurveyMutation.isPending}
        />
      )}

      {editingSurvey && (
        <CreateSurveyDialog
          open={Boolean(editingSurveyId)}
          onOpenChange={(open) => {
            if (!open) setEditingSurveyId(null)
          }}
          teams={teams}
          organizations={organizations}
          currentUserRole={currentUser?.role}
          editingSurvey={editingSurvey}
          onCreate={() => {}}
          onUpdate={(data) =>
            updateSurveyMutation.mutate(
              { surveyId: editingSurvey.id, data },
              { onSuccess: () => setEditingSurveyId(null) },
            )
          }
          isCreating={updateSurveyMutation.isPending}
        />
      )}
    </div>
  )
}
