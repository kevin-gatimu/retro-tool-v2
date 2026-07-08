import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/user-avatar'
import type { StandupSubmission } from '@/common/types/standups'

interface CommentsPanelProps {
  submission: StandupSubmission | null
  currentUserId: string
  canManage: boolean
  onClose: () => void
  onAddComment: (submissionId: string, content: string) => void
  onDeleteComment: (commentId: string) => void
  isPosting: boolean
}

export function CommentsPanel({
  submission,
  currentUserId,
  canManage,
  onClose,
  onAddComment,
  onDeleteComment,
  isPosting,
}: CommentsPanelProps) {
  const [draft, setDraft] = useState('')
  const listEndRef = useRef<HTMLDivElement | null>(null)
  const commentCount = submission?.comments.length ?? 0

  // Keep the newest comment in view when the thread grows.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [commentCount])

  const handlePost = () => {
    if (!submission || !draft.trim()) return
    onAddComment(submission.id, draft.trim())
    setDraft('')
  }

  return (
    <Sheet
      open={submission !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Comments
            {commentCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({commentCount})
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            {submission ? `On ${submission.user.name}'s update` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {submission && commentCount === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="rounded-full bg-muted p-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No comments yet</p>
              <p className="max-w-56 text-xs text-muted-foreground">
                Ask a question, offer support, or celebrate a win.
              </p>
            </div>
          ) : null}

          {submission?.comments.map((comment) => {
            const canDelete = comment.authorId === currentUserId || canManage
            return (
              <div key={comment.id} className="group flex items-start gap-3">
                <UserAvatar
                  image={comment.author.image}
                  name={comment.author.name}
                  size="sm"
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold">
                      {comment.author.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleTimeString(
                        undefined,
                        { hour: 'numeric', minute: '2-digit' },
                      )}
                    </span>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        onClick={() => onDeleteComment(comment.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete comment</span>
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 rounded-lg rounded-tl-none bg-muted/60 px-3 py-2">
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {comment.content}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={listEndRef} />
        </div>

        <SheetFooter className="gap-3 border-t px-6 py-4">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a comment…"
            rows={2}
            maxLength={1000}
            className="resize-none"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                handlePost()
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Ctrl+Enter to post
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePost}
                disabled={!draft.trim() || isPosting}
              >
                {isPosting ? 'Posting…' : 'Post'}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
