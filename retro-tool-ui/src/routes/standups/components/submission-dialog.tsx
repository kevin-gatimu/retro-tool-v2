import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type {
  StandupQuestion,
  StandupSubmission,
  SubmitStandupInput,
} from '@/common/types/standups'
import { formatEntryDate } from '../helpers'

interface SubmissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  questions: StandupQuestion[]
  existingSubmission: StandupSubmission | null
  onSubmit: (data: SubmitStandupInput) => void
  isSubmitting: boolean
}

export function SubmissionDialog({
  open,
  onOpenChange,
  date,
  questions,
  existingSubmission,
  onSubmit,
  isSubmitting,
}: SubmissionDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  // Prefill from the existing submission each time the dialog opens.
  useEffect(() => {
    if (!open) return
    const initial: Record<string, string> = {}
    for (const question of questions) {
      initial[question.id] =
        existingSubmission?.answers.find(
          (answer) => answer.questionId === question.id,
        )?.content ?? ''
    }
    setAnswers(initial)
  }, [open, questions, existingSubmission])

  const missingRequired = questions.some(
    (question) => question.isRequired && !(answers[question.id] ?? '').trim(),
  )

  const handleSubmit = () => {
    onSubmit({
      answers: questions.map((question) => ({
        questionId: question.id,
        content: (answers[question.id] ?? '').trim(),
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {existingSubmission ? 'Update Submission' : 'Add Submission'}
          </DialogTitle>
          <DialogDescription>{formatEntryDate(date)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {questions.map((question) => (
            <div
              key={question.id}
              className="space-y-2 border-l-4 pl-3"
              style={{ borderLeftColor: question.color ?? '#94a3b8' }}
            >
              <Label htmlFor={`answer-${question.id}`} className="font-medium">
                {question.prompt}
                {question.isRequired ? (
                  <span className="text-destructive"> *</span>
                ) : null}
              </Label>
              <Textarea
                id={`answer-${question.id}`}
                value={answers[question.id] ?? ''}
                onChange={(event) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [question.id]: event.target.value,
                  }))
                }
                placeholder="Answer here…"
                rows={3}
                maxLength={5000}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={missingRequired || isSubmitting}
          >
            {isSubmitting
              ? 'Submitting…'
              : existingSubmission
                ? 'Update'
                : 'Submit Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
