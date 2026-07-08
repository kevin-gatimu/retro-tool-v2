import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, Lock, Star } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useSurveyMutations } from '@/hooks/use-survey-mutations'
import { SurveyListConvexSync } from '@/routes/surveys/components/survey-list-convex-sync'
import { usesConvexForSurveys } from '@/lib/realtime-config'
import { api } from '@/lib/api'
import { SURVEYS_ENDPOINTS } from '@/lib/api-endpoints'
import { SURVEY_QUESTION_TYPES } from '@/common/enums/survey.enums'
import { cn } from '@/lib/utils'
import type {
  SurveyAnswerInput,
  SurveyDetail,
  SurveyQuestionResults,
  SurveyQuestionView,
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

  const { respondMutation } = useSurveyMutations(() => {
    void queryClient.invalidateQueries({ queryKey: ['survey', surveyId] })
    void queryClient.invalidateQueries({ queryKey: ['surveys'] })
  })

  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({})
  const [showErrors, setShowErrors] = useState(false)

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

  const showResults = detail.results != null
  const canRespond = !detail.isClosed && !detail.hasResponded && !showResults

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

    respondMutation.mutate({ surveyId, answers: payload })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {convexRealtime ? <SurveyListConvexSync /> : null}
      <BackLink />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{detail.scopeLabel}</Badge>
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
        <h1 className="text-3xl font-bold tracking-tight">{detail.title}</h1>
        {detail.description && (
          <p className="text-muted-foreground">{detail.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {detail.responseCount} response
          {detail.responseCount === 1 ? '' : 's'}
          {detail.createdBy ? ` · by ${detail.createdBy.name}` : ''}
        </p>
      </div>

      {showResults ? (
        <SurveyResults results={detail.results ?? []} />
      ) : canRespond ? (
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
            <Button
              className="ml-auto"
              onClick={handleSubmit}
              disabled={respondMutation.isPending}
            >
              {respondMutation.isPending ? 'Submitting…' : 'Submit response'}
            </Button>
          </div>
        </div>
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
