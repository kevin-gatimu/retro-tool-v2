import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface RoundModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasCurrentRound: boolean
  roundTicket: string
  onRoundTicketChange: (value: string) => void
  onStartRound: () => void
  isPending: boolean
}

export function RoundModal({
  open,
  onOpenChange,
  hasCurrentRound,
  roundTicket,
  onRoundTicketChange,
  onStartRound,
  isPending,
}: RoundModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {hasCurrentRound ? 'Start Next Round' : 'Start First Round'}
          </DialogTitle>
          <DialogDescription>
            Enter the ticket number to start the next estimation round.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            placeholder="SPR-001"
            value={roundTicket}
            onChange={(e) => onRoundTicketChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!isPending) {
                  onStartRound()
                }
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onStartRound} disabled={isPending}>
            {isPending ? 'Starting...' : 'Start Round'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
