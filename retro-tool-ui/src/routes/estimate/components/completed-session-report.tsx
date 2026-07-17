import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, CalendarClock, Hash, Spade, Timer } from 'lucide-react'
import { useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { EstimateSession } from '@/common/types/estimates'
import { ReportMenu } from '@/components/report-menu'
import {
  closestTemplateLabel,
  formatTemplatePoint,
  getRoundDurationLabel,
} from '../helpers'
import { exportEstimatePdf } from '../helpers/export-estimate-pdf'
import { useSendEstimateReport } from '../hooks/use-send-estimate-report'

export function CompletedSessionReport({
  session,
}: {
  session: EstimateSession
}) {
  const PAGE_SIZE = 5

  const uniqueParticipants = session.participants.filter(
    (p, i, arr) => arr.findIndex((x) => x.userId === p.userId) === i,
  )

  const [roundPageMap, setRoundPageMap] = useState<Record<string, number>>({})

  const sendReportMutation = useSendEstimateReport(session.id)

  const totalVotes = session.rounds.reduce(
    (sum, round) => sum + round.votes.length,
    0,
  )

  const getRoundPage = (roundId: string) => roundPageMap[roundId] ?? 1

  const setRoundPage = (roundId: string, page: number) => {
    setRoundPageMap((prev) => ({ ...prev, [roundId]: page }))
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Report Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/estimate">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Spade className="h-6 w-6 text-primary" />
                {session.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {session.team.name} · Session Report
              </p>
              {session.sprintLink && (
                <a
                  href={session.sprintLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline underline-offset-2"
                >
                  Open sprint board
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Completed</Badge>
            <ReportMenu
              teamId={session.team.id}
              onExportPdf={async () => {
                try {
                  const filename = await exportEstimatePdf(session)
                  if (filename) toast.success(`Report saved — ${filename}`)
                } catch (e) {
                  toast.error(
                    e instanceof Error
                      ? e.message
                      : 'Failed to export the report',
                  )
                }
              }}
              onSendEmail={(recipients) =>
                sendReportMutation.mutate({ recipients })
              }
              isSending={sendReportMutation.isPending}
              dialogTitle="Email estimate report"
              dialogDescription="Send this session's report to the whole team, or pick specific people."
            />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Rounds</CardDescription>
              <CardTitle className="text-base truncate">
                {session.rounds.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Date</CardDescription>
              <CardTitle className="text-base">
                {new Date(session.updatedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Participants</CardDescription>
              <CardTitle className="text-base">
                {uniqueParticipants.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Votes Cast</CardDescription>
              <CardTitle className="text-base">{totalVotes}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {session.rounds.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                No round data recorded for this session.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {session.rounds.map((round) => (
              <Card key={round.id} className="border-l-4 border-l-primary/60">
                <CardHeader className="space-y-3 rounded-t-md border-b bg-linear-to-r from-primary/15 via-primary/5 to-transparent">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        Round {round.roundNumber}
                      </div>

                      <CardTitle className="text-lg sm:text-xl">
                        Ticket No: {round.ticketNumber}
                      </CardTitle>

                      {round.storyName &&
                        round.storyName !== round.ticketNumber && (
                          <CardDescription className="text-sm text-muted-foreground">
                            {round.storyName}
                          </CardDescription>
                        )}
                    </div>

                    <div className="grid gap-2 sm:justify-items-end">
                      <div className="inline-flex items-center gap-2 rounded-md border bg-background/80 px-3 py-1 text-xs">
                        <Timer className="h-3.5 w-3.5 text-primary" />
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="font-semibold text-foreground">
                          {getRoundDurationLabel(round) ?? 'Not available'}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-md border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Started {new Date(round.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  {round.storyDescription && (
                    <p className="text-sm text-muted-foreground">
                      {round.storyDescription}
                    </p>
                  )}

                  {round.storyLink && (
                    <a
                      href={round.storyLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline underline-offset-2 break-all"
                    >
                      {round.storyLink}
                    </a>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Votes</p>
                      <p className="text-sm font-semibold">
                        {round.stats.votesCount}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-sm font-semibold">
                        {round.stats.average !== null ? (
                          <>
                            {round.stats.average}
                            {(() => {
                              const hint = closestTemplateLabel(
                                round.stats.average,
                                session.template,
                              )
                              return hint ? (
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  (~{hint})
                                </span>
                              ) : null
                            })()}
                          </>
                        ) : (
                          '—'
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Range</p>
                      <p className="text-sm font-semibold">
                        {round.stats.min !== null && round.stats.max !== null
                          ? `${formatTemplatePoint(round.stats.min, session.template)} – ${formatTemplatePoint(round.stats.max, session.template)}`
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-md border-2 border-primary/50 bg-primary/10 p-2 shadow-sm">
                      <p className="text-xs text-muted-foreground">
                        Agreed Points
                      </p>
                      <p className="text-lg font-extrabold text-primary">
                        {round.agreedPoints !== null
                          ? formatTemplatePoint(
                              round.agreedPoints,
                              session.template,
                            )
                          : round.stats.average !== null
                            ? formatTemplatePoint(
                                round.stats.average,
                                session.template,
                              )
                            : '—'}
                      </p>
                    </div>
                  </div>

                  {round.votes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No votes recorded for this round.
                    </p>
                  ) : (
                    <div className="space-y-3 overflow-x-auto">
                      {(() => {
                        const currentPage = getRoundPage(round.id)
                        const totalPages = Math.max(
                          1,
                          Math.ceil(round.votes.length / PAGE_SIZE),
                        )
                        const safePage = Math.min(currentPage, totalPages)
                        if (safePage !== currentPage) {
                          setRoundPage(round.id, safePage)
                        }

                        const startIndex = (safePage - 1) * PAGE_SIZE
                        const pagedVotes = round.votes.slice(
                          startIndex,
                          startIndex + PAGE_SIZE,
                        )

                        const shouldPaginate = round.votes.length > PAGE_SIZE

                        return (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Member</TableHead>
                                  <TableHead>Role</TableHead>
                                  <TableHead className="text-right">
                                    Estimate
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pagedVotes.map((vote) => {
                                  const participant = uniqueParticipants.find(
                                    (p) => p.userId === vote.voterId,
                                  )
                                  return (
                                    <TableRow key={vote.id}>
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-6 w-6">
                                            <AvatarImage
                                              src={
                                                participant?.user.image ??
                                                undefined
                                              }
                                            />
                                            <AvatarFallback>
                                              {vote.user.name.charAt(0)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span>{vote.user.name}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {vote.user.jobRole ? (
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            {vote.user.jobRole}
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            —
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span className="inline-flex min-w-10 items-center justify-center rounded-md border-2 border-primary bg-primary/10 px-2 py-1 text-sm font-bold text-primary">
                                          {formatTemplatePoint(
                                            vote.points,
                                            session.template,
                                          )}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>

                            {shouldPaginate && (
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                  Showing{' '}
                                  {Math.min(startIndex + 1, round.votes.length)}
                                  -
                                  {Math.min(
                                    startIndex + PAGE_SIZE,
                                    round.votes.length,
                                  )}{' '}
                                  of {round.votes.length}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setRoundPage(
                                        round.id,
                                        Math.max(1, safePage - 1),
                                      )
                                    }
                                    disabled={safePage <= 1}
                                  >
                                    Prev
                                  </Button>
                                  <span className="text-xs text-muted-foreground">
                                    Page {safePage} / {totalPages}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setRoundPage(
                                        round.id,
                                        Math.min(totalPages, safePage + 1),
                                      )
                                    }
                                    disabled={safePage >= totalPages}
                                  >
                                    Next
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
