import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Lock,
  Star,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/user-avatar'
import { useSurveyMutations } from '@/hooks/use-survey-mutations'
import { SurveyReportMenu } from '@/components/surveys/survey-report-menu'
import { exportSurveyPdf } from '@/routes/surveys/helpers/export-survey-pdf'
import { SurveyListConvexSync } from '@/routes/surveys/components/survey-list-convex-sync'
import { usesConvexForSurveys } from '@/lib/realtime-config'
import { api } from '@/lib/api'
import { SURVEYS_ENDPOINTS } from '@/lib/api-endpoints'
import { SURVEY_QUESTION_TYPES } from '@/common/enums/survey.enums'
import { cn } from '@/lib/utils'
import type {
  SurveyAnswerInput,
  SurveyAnswerView,
  SurveyDetail,
  SurveyQuestionResults,
  SurveyQuestionView,
  SurveyRespondentView,
} from '@/common/types/surveys'

export const Route = createFileRoute('/surveys/$surveyId')({
  component: SurveyDetailPage,
})

const RATING_VALUES = [1, 2, 3, 4, 5] as const

interface DraftAnswer {
  textValue: string
  ratingValue: number | null
  choiceValue: string
}

function emptyDraft(): DraftAnswer {
  return { textValue: '', ratingValue: null, choiceValue: '' }
}

/** Seed the draft state from the caller's saved answers, for the edit form. */
function draftsFromAnswers(
  myAnswers: SurveyAnswerView[],
): Record<string, DraftAnswer> {
  const drafts: Record<string, DraftAnswer> = {}
  for (const answer of myAnswers) {
    drafts[answer.questionId] = {
      textValue: answer.textValue ?? '',
      ratingValue: answer.ratingValue,
      choiceValue: answer.choiceValue ?? '',
    }
  }
  return drafts
}

function SurveyDetailPage() {
  const { surveyId } = Route.useParams()
  const queryClient = useQueryClient()
  const convexRealtime = usesConvexForSurveys()

  const {
    data: detail,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => api.get<SurveyDetail>(SURVEYS_ENDPOINTS.BY_ID(surveyId)),
    staleTime: 10_000,
  })

  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({})
  const [showErrors, setShowErrors] = useState(false)
  const [viewResults, setViewResults] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const { respondMutation, emailResultsMutation } = useSurveyMutations(() => {
    void queryClient.invalidateQueries({ queryKey: ['survey', surveyId] })
    void queryClient.invalidateQueries({ queryKey: ['surveys'] })
    // Leave edit mode so the refreshed results/answers show.
    setIsEditing(false)
    setShowErrors(false)
  })

  const getDraft = (questionId: string): DraftAnswer =>
    answers[questionId] ?? emptyDraft()

  const setDraft = (questionId: string, patch: Partial<DraftAnswer>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...emptyDraft(), ...prev[questionId], ...patch },
    }))
  }

  const questions = detail?.questions ?? []

  const missingRequired = useMemo(() => {
    return questions.filter((q) => {
      if (!q.isRequired) return false
      const draft = getDraft(q.id)
      if (q.type === SURVEY_QUESTION_TYPES.Text) {
        return draft.textValue.trim().length === 0
      }
      if (q.type === SURVEY_QUESTION_TYPES.Rating) {
        return draft.ratingValue == null
      }
      return draft.choiceValue.length === 0
    })
  }, [questions, answers])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {convexRealtime ? <SurveyListConvexSync /> : null}
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !detail) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            This survey could not be loaded. It may have been deleted or you may
            not have access to it.
          </CardContent>
        </Card>
      </div>
    )
  }

  // A user may respond while the survey is open and they haven't answered yet,
  // and may edit an existing response while it's still open. Managers also
  // receive `results` for preview. The form shows for a fresh response or while
  // editing; otherwise results are shown (forced when there's nothing to answer
  // or the user opts into the preview).
  const hasResults = detail.results != null
  const canRespondFresh = !detail.isClosed && !detail.hasResponded
  const canEditResponse =
    !detail.isClosed && detail.hasResponded && detail.myAnswers != null
  // Editing always wins; a fresh responder sees the form unless they opt into
  // the results preview (`viewResults`).
  const showForm = isEditing || (canRespondFresh && !viewResults)
  const showResults = !showForm && hasResults
  // The server decides who may see per-respondent submissions: everyone (with
  // names) for non-anonymous surveys, managers only (with identity stripped to
  // "Anonymous") for anonymous ones. If it sent any, show the Responses tab.
  const respondents = detail.respondents ?? []
  const showRespondentTabs = respondents.length > 0

  const startEditing = () => {
    if (detail.myAnswers) setAnswers(draftsFromAnswers(detail.myAnswers))
    setShowErrors(false)
    setViewResults(false)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setShowErrors(false)
    setIsEditing(false)
  }

  const handleSubmit = () => {
    if (missingRequired.length > 0) {
      setShowErrors(true)
      return
    }

    const payload: SurveyAnswerInput[] = questions
      .map((q): SurveyAnswerInput | null => {
        const draft = getDraft(q.id)
        if (q.type === SURVEY_QUESTION_TYPES.Text) {
          const text = draft.textValue.trim()
          if (text.length === 0) return null
          return { questionId: q.id, textValue: text }
        }
        if (q.type === SURVEY_QUESTION_TYPES.Rating) {
          if (draft.ratingValue == null) return null
          return { questionId: q.id, ratingValue: draft.ratingValue }
        }
        if (draft.choiceValue.length === 0) return null
        return { questionId: q.id, choiceValue: draft.choiceValue }
      })
      .filter((a): a is SurveyAnswerInput => a !== null)

    respondMutation.mutate({ surveyId, answers: payload, isEdit: isEditing })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {convexRealtime ? <SurveyListConvexSync /> : null}
      <BackLink />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{detail.scopeLabel}</Badge>
          {detail.isAnonymous && (
            <Badge className="gap-1 border-transparent bg-violet-500/15 text-violet-600 hover:bg-violet-500/20 dark:text-violet-300">
              <EyeOff className="h-3 w-3 animate-pulse" />
              Anonymous
            </Badge>
          )}
          {detail.isClosed ? (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" />
              Closed
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400">
              Active
            </Badge>
          )}
          {detail.hasResponded && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              You responded
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{detail.title}</h1>
          {detail.canManage && hasResults && (
            <SurveyReportMenu
              scope={detail.scope}
              teamId={detail.teamId}
              organizationId={detail.organizationId}
              onExportPdf={() => {
                void exportSurveyPdf(detail)
              }}
              onSendEmail={(recipients) =>
                emailResultsMutation.mutate({ surveyId, recipients })
              }
              isSending={emailResultsMutation.isPending}
            />
          )}
        </div>
        {detail.description && (
          <p className="text-muted-foreground">{detail.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {detail.responseCount} response
          {detail.responseCount === 1 ? '' : 's'}
          {detail.createdBy ? ` · by ${detail.createdBy.name}` : ''}
        </p>
        {canEditResponse && !isEditing && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm"
            onClick={startEditing}
          >
            Edit my response
          </Button>
        )}
        {hasResults && canRespondFresh && !isEditing && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm"
            onClick={() => setViewResults((prev) => !prev)}
          >
            {viewResults ? 'Back to survey' : 'View results instead'}
          </Button>
        )}
      </div>

      {showForm ? (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <ResponseQuestion
              key={question.id}
              question={question}
              index={index}
              draft={getDraft(question.id)}
              showError={showErrors && missingRequired.includes(question)}
              onChange={(patch) => setDraft(question.id, patch)}
            />
          ))}

          <div className="flex items-center justify-between gap-3">
            {showErrors && missingRequired.length > 0 && (
              <p className="text-sm text-destructive">
                Please answer all required questions.
              </p>
            )}
            <div className="ml-auto flex items-center gap-2">
              {isEditing && (
                <Button
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={respondMutation.isPending}
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={respondMutation.isPending}
              >
                {respondMutation.isPending
                  ? 'Saving…'
                  : isEditing
                    ? 'Save changes'
                    : 'Submit response'}
              </Button>
            </div>
          </div>
        </div>
      ) : showResults ? (
        showRespondentTabs ? (
          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="responses">
                Responses ({respondents.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <SurveyResults results={detail.results ?? []} />
            </TabsContent>
            <TabsContent value="responses">
              <SurveyRespondents
                respondents={respondents}
                questions={questions}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <SurveyResults results={detail.results ?? []} />
        )
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {detail.isClosed
              ? 'This survey is closed and no longer accepting responses.'
              : 'Results will be available once you respond or after responses come in.'}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/surveys"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to surveys
    </Link>
  )
}

interface ResponseQuestionProps {
  question: SurveyQuestionView
  index: number
  draft: DraftAnswer
  showError: boolean
  onChange: (patch: Partial<DraftAnswer>) => void
}

function ResponseQuestion({
  question,
  index,
  draft,
  showError,
  onChange,
}: ResponseQuestionProps) {
  return (
    <Card className={cn(showError && 'border-destructive')}>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          <span className="mr-1 text-muted-foreground">Q{index + 1}.</span>
          {question.prompt}
          {question.isRequired && (
            <span className="ml-1 text-destructive">*</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {question.type === SURVEY_QUESTION_TYPES.Text && (
          <Textarea
            value={draft.textValue}
            onChange={(event) => onChange({ textValue: event.target.value })}
            placeholder="Your answer"
            maxCharacters={2000}
            className="bg-background"
          />
        )}

        {question.type === SURVEY_QUESTION_TYPES.Rating && (
          <div className="flex items-center gap-1">
            {RATING_VALUES.map((value) => {
              const active =
                draft.ratingValue != null && value <= draft.ratingValue
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value === 1 ? '' : 's'}`}
                  onClick={() => onChange({ ratingValue: value })}
                  className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    className={cn(
                      'h-7 w-7 transition-colors',
                      active
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/40',
                    )}
                  />
                </button>
              )
            })}
            {draft.ratingValue != null && (
              <span className="ml-2 text-sm text-muted-foreground">
                {draft.ratingValue} / 5
              </span>
            )}
          </div>
        )}

        {question.type === SURVEY_QUESTION_TYPES.Choice && (
          <RadioGroup
            value={draft.choiceValue}
            onValueChange={(value) => onChange({ choiceValue: value })}
          >
            {question.options.map((option, optIndex) => {
              const id = `${question.id}-opt-${optIndex}`
              const selected = draft.choiceValue === option
              return (
                <Label
                  key={id}
                  htmlFor={id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 font-normal transition-colors',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/60 hover:bg-muted/50',
                  )}
                >
                  <RadioGroupItem value={option} id={id} />
                  {option}
                </Label>
              )
            })}
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  )
}

function formatAnswerValue(
  answer: SurveyAnswerView | undefined,
  type: SurveyQuestionView['type'],
): string | null {
  if (!answer) return null
  if (type === SURVEY_QUESTION_TYPES.Text) {
    const text = answer.textValue?.trim()
    return text && text.length > 0 ? text : null
  }
  if (type === SURVEY_QUESTION_TYPES.Rating) {
    return answer.ratingValue != null ? `${answer.ratingValue} / 5` : null
  }
  return answer.choiceValue && answer.choiceValue.length > 0
    ? answer.choiceValue
    : null
}

function SurveyRespondents({
  respondents,
  questions,
}: {
  respondents: SurveyRespondentView[]
  questions: SurveyQuestionView[]
}) {
  // Show one respondent at a time to avoid an unbounded scroll for surveys with
  // many questions and many responses; navigate with Prev/Next.
  const [index, setIndex] = useState(0)

  if (respondents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No responses yet.
        </CardContent>
      </Card>
    )
  }

  // Guard against an out-of-range index if the respondent list shrinks (e.g. a
  // realtime refetch drops a response while a later page is open).
  const current = Math.min(index, respondents.length - 1)
  const respondent = respondents[current]
  const answerByQuestion = new Map(
    respondent.answers.map((answer) => [answer.questionId, answer]),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
          disabled={current === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Response {current + 1} of {respondents.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setIndex((prev) => Math.min(respondents.length - 1, prev + 1))
          }
          disabled={current >= respondents.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card key={respondent.userId}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <UserAvatar
              image={respondent.image}
              name={respondent.name}
              userId={respondent.userId}
              size="sm"
            />
            {respondent.name ?? 'Anonymous'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((question, questionIndex) => {
            const value = formatAnswerValue(
              answerByQuestion.get(question.id),
              question.type,
            )
            return (
              <div key={question.id} className="space-y-1">
                <p className="text-sm font-medium">
                  <span className="mr-1 text-muted-foreground">
                    Q{questionIndex + 1}.
                  </span>
                  {question.prompt}
                </p>
                {value != null ? (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {value}
                  </p>
                ) : (
                  <p className="px-1 text-sm italic text-muted-foreground">
                    No answer
                  </p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function SurveyResults({ results }: { results: SurveyQuestionResults[] }) {
  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No results to show yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {results.map((result, index) => (
        <QuestionResultCard
          key={result.questionId}
          result={result}
          index={index}
        />
      ))}
    </div>
  )
}

function QuestionResultCard({
  result,
  index,
}: {
  result: SurveyQuestionResults
  index: number
}) {
  const maxCount = Math.max(1, ...result.optionCounts.map((o) => o.count))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          <span className="mr-1 text-muted-foreground">Q{index + 1}.</span>
          {result.prompt}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {result.answerCount} response
          {result.answerCount === 1 ? '' : 's'}
          {result.type === SURVEY_QUESTION_TYPES.Rating &&
            result.averageRating != null &&
            ` · avg ${result.averageRating.toFixed(1)} / 5`}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.type === SURVEY_QUESTION_TYPES.Text ? (
          result.textAnswers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No answers yet.</p>
          ) : (
            <ul className="space-y-2">
              {result.textAnswers.map((answer, i) => (
                <li
                  key={i}
                  className="rounded-md border bg-muted/40 px-3 py-2 text-sm"
                >
                  {answer}
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-2">
            {result.optionCounts.map((option) => {
              const percent =
                result.answerCount > 0
                  ? Math.round((option.count / result.answerCount) * 100)
                  : 0
              const barWidth = Math.round((option.count / maxCount) * 100)
              return (
                <div key={option.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{option.label}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {option.count} · {percent}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
