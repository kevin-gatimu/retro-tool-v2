import { useEffect, useState } from 'react'
import { GripVertical, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  SURVEY_QUESTION_TYPES,
  SURVEY_SCOPES,
} from '@/common/enums/survey.enums'
import type {
  TSurveyQuestionType,
  TSurveyScope,
} from '@/common/enums/survey.enums'
import { isSystemAdmin } from '@/lib/rbac'
import type { UserRole } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import type {
  CreateSurveyInput,
  CreateSurveyQuestionInput,
  SurveyDetail,
  UpdateSurveyInput,
  UpdateSurveyQuestionInput,
} from '@/common/types/surveys'
import type { Team } from '@/common/types/teams'

/** Minimal org shape the dialog needs for scope gating + picking. */
export interface SurveyDialogOrg {
  id: string
  name: string
  myRole?: string
}

interface QuestionDraft {
  key: string
  /** Existing question id when editing; undefined for newly-added questions. */
  id?: string
  type: TSurveyQuestionType
  prompt: string
  isRequired: boolean
  options: string[]
}

const MAX_QUESTIONS = 15
const MAX_OPTIONS = 10

const QUESTION_TYPE_LABELS: Record<TSurveyQuestionType, string> = {
  [SURVEY_QUESTION_TYPES.Text]: 'Text',
  [SURVEY_QUESTION_TYPES.Rating]: 'Rating (1–5)',
  [SURVEY_QUESTION_TYPES.Choice]: 'Multiple choice',
}

let questionKeySeq = 0
const nextKey = () => `q-${questionKeySeq++}`

const newQuestion = (): QuestionDraft => ({
  key: nextKey(),
  type: SURVEY_QUESTION_TYPES.Text,
  prompt: '',
  isRequired: true,
  options: [],
})

interface CreateSurveyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teams: Team[]
  organizations: SurveyDialogOrg[]
  currentUserRole?: UserRole
  onCreate: (data: CreateSurveyInput) => void
  isCreating: boolean
  /** When provided, the dialog runs in edit mode (scope is locked). */
  editingSurvey?: SurveyDetail
  onUpdate?: (data: UpdateSurveyInput) => void
}

export function CreateSurveyDialog({
  open,
  onOpenChange,
  teams,
  organizations,
  currentUserRole,
  onCreate,
  isCreating,
  editingSurvey,
  onUpdate,
}: CreateSurveyDialogProps) {
  const isEdit = Boolean(editingSurvey)
  const sysAdmin = isSystemAdmin(currentUserRole)
  const adminOrgs = organizations.filter(
    (org) =>
      sysAdmin || org.myRole === 'org-owner' || org.myRole === 'org-admin',
  )

  const canScopeTeam = teams.length > 0
  const canScopeOrg = sysAdmin || adminOrgs.length > 0
  const canScopeSystem = sysAdmin

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [scope, setScope] = useState<TSurveyScope>(SURVEY_SCOPES.Team)
  const [teamId, setTeamId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()])

  useEffect(() => {
    if (!open) return

    if (editingSurvey) {
      // Edit mode: prefill from the survey. Scope/team/org are immutable.
      setTitle(editingSurvey.title)
      setDescription(editingSurvey.description ?? '')
      setIsAnonymous(editingSurvey.isAnonymous)
      setScope(editingSurvey.scope)
      setTeamId(editingSurvey.teamId ?? '')
      setOrganizationId(editingSurvey.organizationId ?? '')
      setQuestions(
        editingSurvey.questions.map((question) => ({
          key: nextKey(),
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          isRequired: question.isRequired,
          options: question.options,
        })),
      )
      return
    }

    setTitle('')
    setDescription('')
    setIsAnonymous(false)
    // Default to the first scope the user is actually allowed to use.
    setScope(
      canScopeTeam
        ? SURVEY_SCOPES.Team
        : canScopeOrg
          ? SURVEY_SCOPES.Org
          : SURVEY_SCOPES.System,
    )
    setTeamId('')
    setOrganizationId('')
    setQuestions([newQuestion()])
  }, [open, editingSurvey, canScopeTeam, canScopeOrg])

  const showTeamPicker = scope === SURVEY_SCOPES.Team && teams.length > 1
  const showOrgPicker = scope === SURVEY_SCOPES.Org && adminOrgs.length > 1

  const effectiveTeamId =
    scope === SURVEY_SCOPES.Team
      ? teams.length === 1
        ? teams[0].id
        : teamId
      : ''
  const effectiveOrgId =
    scope === SURVEY_SCOPES.Org
      ? adminOrgs.length === 1
        ? adminOrgs[0].id
        : organizationId
      : ''

  const updateQuestion = (key: string, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    )
  }

  const changeQuestionType = (key: string, type: TSurveyQuestionType) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.key !== key) return q
        // Seed two empty options when switching into choice.
        const options =
          type === SURVEY_QUESTION_TYPES.Choice
            ? q.options.length >= 2
              ? q.options
              : ['', '']
            : []
        return { ...q, type, options }
      }),
    )
  }

  const updateOption = (key: string, index: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key
          ? {
              ...q,
              options: q.options.map((o, i) => (i === index ? value : o)),
            }
          : q,
      ),
    )
  }

  const addOption = (key: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key && q.options.length < MAX_OPTIONS
          ? { ...q, options: [...q.options, ''] }
          : q,
      ),
    )
  }

  const removeOption = (key: string, index: number) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key && q.options.length > 2
          ? { ...q, options: q.options.filter((_, i) => i !== index) }
          : q,
      ),
    )
  }

  const scopeValid =
    scope === SURVEY_SCOPES.Team
      ? effectiveTeamId.length > 0
      : scope === SURVEY_SCOPES.Org
        ? effectiveOrgId.length > 0
        : true

  const questionsValid =
    questions.length >= 1 &&
    questions.length <= MAX_QUESTIONS &&
    questions.every((q) => {
      if (q.prompt.trim().length === 0) return false
      if (q.type === SURVEY_QUESTION_TYPES.Choice) {
        const filled = q.options.filter((o) => o.trim().length > 0)
        return filled.length >= 2
      }
      return true
    })

  const canSubmit =
    title.trim().length > 0 && scopeValid && questionsValid && !isCreating

  const submitLabel = (() => {
    if (isEdit) return isCreating ? 'Saving…' : 'Save changes'
    return isCreating ? 'Creating…' : 'Create Survey'
  })()

  const handleSubmit = () => {
    // Shared question shape for both create and edit payloads; edit additionally
    // carries `id` so existing questions can be reconciled in place.
    const toQuestion = (q: QuestionDraft): CreateSurveyQuestionInput => ({
      type: q.type,
      prompt: q.prompt.trim(),
      isRequired: q.isRequired,
      options:
        q.type === SURVEY_QUESTION_TYPES.Choice
          ? q.options.map((o) => o.trim()).filter((o) => o.length > 0)
          : undefined,
    })

    if (editingSurvey && onUpdate) {
      const questionsPayload: UpdateSurveyQuestionInput[] = questions.map(
        (q) => ({ id: q.id, ...toQuestion(q) }),
      )

      onUpdate({
        title: title.trim(),
        description: description.trim() || undefined,
        isAnonymous,
        questions: questionsPayload,
      })
      return
    }

    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      scope,
      teamId: scope === SURVEY_SCOPES.Team ? effectiveTeamId : undefined,
      organizationId: scope === SURVEY_SCOPES.Org ? effectiveOrgId : undefined,
      isAnonymous,
      questions: questions.map(toQuestion),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Survey' : 'Create Survey'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the title, description, and questions. Scope cannot be changed.'
              : 'Collect structured feedback with a set of questions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="survey-title">Title</Label>
            <Input
              id="survey-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Q3 Team Health Check"
              maxLength={200}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="survey-description">Description (optional)</Label>
            <Textarea
              id="survey-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A short note about what this survey is for."
              maxCharacters={1000}
              className="bg-background"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-scope">Scope</Label>
              <Select
                value={scope}
                onValueChange={(value) => setScope(value as TSurveyScope)}
                disabled={isEdit}
              >
                <SelectTrigger
                  id="survey-scope"
                  className="w-full bg-background"
                >
                  <SelectValue placeholder="Select a scope" />
                </SelectTrigger>
                <SelectContent>
                  {canScopeTeam && (
                    <SelectItem value={SURVEY_SCOPES.Team}>Team</SelectItem>
                  )}
                  {canScopeOrg && (
                    <SelectItem value={SURVEY_SCOPES.Org}>
                      Organization
                    </SelectItem>
                  )}
                  {canScopeSystem && (
                    <SelectItem value={SURVEY_SCOPES.System}>
                      System-wide
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {showTeamPicker && (
              <div className="space-y-2">
                <Label htmlFor="survey-team">Team</Label>
                <Select
                  value={teamId}
                  onValueChange={setTeamId}
                  disabled={isEdit}
                >
                  <SelectTrigger
                    id="survey-team"
                    className="w-full bg-background"
                  >
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.emoji ? `${team.emoji} ` : ''}
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showOrgPicker && (
              <div className="space-y-2">
                <Label htmlFor="survey-org">Organization</Label>
                <Select
                  value={organizationId}
                  onValueChange={setOrganizationId}
                  disabled={isEdit}
                >
                  <SelectTrigger
                    id="survey-org"
                    className="w-full bg-background"
                  >
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminOrgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Questions</Label>
              <span className="text-xs text-muted-foreground">
                {questions.length} / {MAX_QUESTIONS}
              </span>
            </div>

            {questions.map((question, index) => (
              <div
                key={question.key}
                className={cn(
                  'space-y-3 rounded-lg border bg-background/50 p-3',
                  'animate-in fade-in-0 slide-in-from-top-1 duration-200',
                )}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Q{index + 1}
                      </span>
                      <Select
                        value={question.type}
                        onValueChange={(value) =>
                          changeQuestionType(
                            question.key,
                            value as TSurveyQuestionType,
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-44 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(SURVEY_QUESTION_TYPES).map((type) => (
                            <SelectItem key={type} value={type}>
                              {QUESTION_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Input
                      value={question.prompt}
                      onChange={(event) =>
                        updateQuestion(question.key, {
                          prompt: event.target.value,
                        })
                      }
                      placeholder="Question prompt"
                      maxLength={500}
                      className="bg-background"
                    />

                    {question.type === SURVEY_QUESTION_TYPES.Choice && (
                      <div className="space-y-2 pl-1">
                        {question.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className="flex items-center gap-2"
                          >
                            <Input
                              value={option}
                              onChange={(event) =>
                                updateOption(
                                  question.key,
                                  optIndex,
                                  event.target.value,
                                )
                              }
                              placeholder={`Option ${optIndex + 1}`}
                              maxLength={255}
                              className="bg-background"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                removeOption(question.key, optIndex)
                              }
                              disabled={question.options.length <= 2}
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Remove option</span>
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(question.key)}
                          disabled={question.options.length >= MAX_OPTIONS}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add option
                        </Button>
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={question.isRequired}
                        onCheckedChange={(checked) =>
                          updateQuestion(question.key, {
                            isRequired: checked === true,
                          })
                        }
                      />
                      Required
                    </label>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setQuestions((prev) =>
                        prev.filter((q) => q.key !== question.key),
                      )
                    }
                    disabled={questions.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove question</span>
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuestions((prev) => [...prev, newQuestion()])}
              disabled={questions.length >= MAX_QUESTIONS}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add question
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isAnonymous}
              onCheckedChange={(checked) => setIsAnonymous(checked === true)}
            />
            Anonymous survey (hide who submitted each response)
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
