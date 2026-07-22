import { createFileRoute } from '@tanstack/react-router'
import { FileText, Layers, Sparkles } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminTemplatesSkeleton } from './skeleton'
import {
  EstimateTemplatesTab,
  IcebreakerTemplatesTab,
  RetroTemplatesTab,
} from './components'

export const Route = createFileRoute('/admin/templates')({
  pendingComponent: AdminTemplatesSkeleton,
  component: AdminTemplatesPage,
})

function AdminTemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Templates</h2>
        <p className="text-muted-foreground">
          Manage retrospective and story estimate templates.
        </p>
      </div>

      <Tabs defaultValue="retro">
        <TabsList>
          <TabsTrigger value="retro">
            <FileText className="h-4 w-4 mr-2" />
            Retrospective Templates
          </TabsTrigger>
          <TabsTrigger value="estimate">
            <Layers className="h-4 w-4 mr-2" />
            Story Estimate Templates
          </TabsTrigger>
          <TabsTrigger value="icebreaker">
            <Sparkles className="h-4 w-4 mr-2" />
            Icebreaker Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="retro" className="mt-6">
          <RetroTemplatesTab />
        </TabsContent>

        <TabsContent value="estimate" className="mt-6">
          <EstimateTemplatesTab />
        </TabsContent>

        <TabsContent value="icebreaker" className="mt-6">
          <IcebreakerTemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
