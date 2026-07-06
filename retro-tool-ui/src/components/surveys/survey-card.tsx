import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  CheckCircle2,
  Lock,
  LockOpen,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { SurveySummary } from '@/common/types/surveys'

interface SurveyCardProps {
  survey: SurveySummary
  onSetClosed: (surveyId: string, isClosed: boolean) => void
  onDelete: (surveyId: string) => void
  onEdit: (surveyId: string) => void
}

export function SurveyCard({
  survey,
  onSetClosed,
  onDelete,
  onEdit,
}: SurveyCardProps) {
  const navigate = useNavigate()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const openSurvey = () =>
    navigate({ to: '/surveys/$surveyId', params: { surveyId: survey.id } })

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={openSurvey}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openSurvey()
          }
        }}
        className={cn(
          'group cursor-pointer transition-all duration-200',
          'animate-in fade-in-0 slide-in-from-bottom-2',
          'hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{survey.scopeLabel}</Badge>
                {survey.isClosed ? (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Closed
                  </Badge>
                ) : (
                  <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Active
                  </Badge>
                )}
                {survey.hasResponded && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Responded
                  </span>
                )}
              </div>
              <p className="font-semibold leading-snug">{survey.title}</p>
              {survey.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {survey.description}
                </p>
              )}
            </div>

            {(survey.canManage || survey.canEdit) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Survey actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(event) => event.stopPropagation()}
                >
                  {survey.canEdit && (
                    <DropdownMenuItem onClick={() => onEdit(survey.id)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit survey
                    </DropdownMenuItem>
                  )}
                  {survey.canManage && (
                    <DropdownMenuItem
                      onClick={() => onSetClosed(survey.id, !survey.isClosed)}
                    >
                      {survey.isClosed ? (
                        <>
                          <LockOpen className="mr-2 h-4 w-4" />
                          Reopen survey
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Close survey
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  {survey.canManage && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmDeleteOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete survey
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {survey.questionCount} question
              {survey.questionCount === 1 ? '' : 's'}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {survey.responseCount} response
              {survey.responseCount === 1 ? '' : 's'}
            </span>
            {survey.createdBy && <span>by {survey.createdBy.name}</span>}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Survey</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{survey.title}&rdquo;? All
              responses will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(survey.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
