import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { IcebreakerRunner } from '@/components/icebreakers/icebreaker-runner'

export const Route = createFileRoute('/icebreakers/$sessionId')({
  component: IcebreakerSessionPage,
})

function IcebreakerSessionPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <IcebreakerRunner
      sessionId={sessionId}
      variant="page"
      onExit={() => navigate({ to: '/icebreakers' })}
    />
  )
}
