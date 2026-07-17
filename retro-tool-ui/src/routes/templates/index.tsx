import { createFileRoute } from '@tanstack/react-router'
import { History, Spade } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isSystemAdmin } from '@/lib/rbac'
import { useCurrentUser } from '@/hooks/use-current-user'
import { TemplatesListSkeleton } from './skeleton'
import { EstimateTemplatesSection, RetroTemplatesSection } from './components'
import {
  estimateTemplatesQueryKey,
  fetchEstimateTemplates,
  fetchRetroTemplates,
  retroTemplatesQueryKey,
} from './hooks'

const DEFAULT_PAGE_SIZE = 6

export const Route = createFileRoute('/templates/')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({
        queryKey: retroTemplatesQueryKey('built-in', 1, DEFAULT_PAGE_SIZE, ''),
        queryFn: () =>
          fetchRetroTemplates('built-in', 1, DEFAULT_PAGE_SIZE, ''),
      }),
      queryClient.ensureQueryData({
        queryKey: retroTemplatesQueryKey(
          'organization',
          1,
          DEFAULT_PAGE_SIZE,
          '',
        ),
        queryFn: () =>
          fetchRetroTemplates('organization', 1, DEFAULT_PAGE_SIZE, ''),
      }),
      queryClient.ensureQueryData({
        queryKey: estimateTemplatesQueryKey(
          'built-in',
          1,
          DEFAULT_PAGE_SIZE,
          '',
        ),
        queryFn: () =>
          fetchEstimateTemplates('built-in', 1, DEFAULT_PAGE_SIZE, ''),
      }),
      queryClient.ensureQueryData({
        queryKey: estimateTemplatesQueryKey(
          'organization',
          1,
          DEFAULT_PAGE_SIZE,
          '',
        ),
        queryFn: () =>
          fetchEstimateTemplates('organization', 1, DEFAULT_PAGE_SIZE, ''),
      }),
    ]),
  pendingComponent: TemplatesListSkeleton,
  component: TemplatesPage,
})

function TemplatesPage() {
  const { data: user } = useCurrentUser()
  const sysAdmin = user?.role ? isSystemAdmin(user.role) : false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">
          Browse and manage retrospective and estimate templates
        </p>
      </div>

      <Tabs defaultValue="retro">
        <TabsList>
          <TabsTrigger value="retro">
            <History className="h-4 w-4 mr-2" />
            Retro Templates
          </TabsTrigger>
          <TabsTrigger value="estimate">
            <Spade className="h-4 w-4 mr-2" />
            Story Estimate Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="retro" className="mt-6">
          <RetroTemplatesSection sysAdmin={sysAdmin} />
        </TabsContent>

        <TabsContent value="estimate" className="mt-6">
          <EstimateTemplatesSection sysAdmin={sysAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
