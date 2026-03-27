import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/sessions')({
  beforeLoad: () => {
    throw redirect({ to: '/profile/sessions' })
  },
})
