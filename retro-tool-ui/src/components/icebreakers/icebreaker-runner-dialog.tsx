import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { IcebreakerRunner } from './icebreaker-runner'

interface IcebreakerRunnerDialogProps {
  /** Session to run, or `null` to keep the modal closed. */
  sessionId: string | null
  onOpenChange: (open: boolean) => void
}

/**
 * Runs an icebreaker inside a modal so it can happen in place — e.g. on the
 * standup page — without navigating away. Closing the modal just leaves the
 * runner; it does NOT end the session, so the host can reopen it to continue.
 */
export function IcebreakerRunnerDialog({
  sessionId,
  onOpenChange,
}: IcebreakerRunnerDialogProps) {
  return (
    <Dialog open={sessionId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {/* Runner renders the session name as its own heading; this title is
            for screen readers only to satisfy the dialog a11y contract. */}
        <DialogTitle className="sr-only">Icebreaker</DialogTitle>
        {sessionId !== null && (
          <IcebreakerRunner
            sessionId={sessionId}
            variant="embedded"
            onExit={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
