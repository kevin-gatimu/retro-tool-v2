import { Edit, FileText, Layers, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Template } from '@/common/types/templates'
import { OrgEstimateTemplatesSection } from '../org-estimate-templates-section'

interface TemplatesTabProps {
  orgId: string
  canManage: boolean
  orgTemplates: Template[]
  onCreateTemplate: () => void
  onEditTemplate: (template: Template) => void
  onDeleteTemplate: (template: Template) => void
}

export function TemplatesTab({
  orgId,
  canManage,
  orgTemplates,
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate,
}: TemplatesTabProps) {
  return (
    <TabsContent value="templates" className="mt-6">
      <Tabs defaultValue="retro">
        <TabsList>
          <TabsTrigger value="retro">
            <FileText className="h-4 w-4 mr-1.5" />
            Retro Templates
          </TabsTrigger>
          <TabsTrigger value="estimate">
            <Layers className="h-4 w-4 mr-1.5" />
            Story Estimates
          </TabsTrigger>
        </TabsList>

        {/* Retro Templates sub-tab */}
        {canManage && (
          <TabsContent value="retro" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Retro Templates</h2>
                <p className="text-sm text-muted-foreground">
                  Manage retro templates for this organisation.
                </p>
              </div>
              <Button onClick={onCreateTemplate} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </div>

            {orgTemplates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="font-medium">No templates yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create your first org-specific template.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {orgTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <CardTitle className="line-clamp-1">
                        {template.name}
                      </CardTitle>
                      {template.description && (
                        <CardDescription className="line-clamp-2">
                          {template.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditTemplate(template)}
                      >
                        <Edit className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDeleteTemplate(template)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* Story Estimate Templates sub-tab */}
        <TabsContent value="estimate" className="mt-4">
          <OrgEstimateTemplatesSection orgId={orgId} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </TabsContent>
  )
}
