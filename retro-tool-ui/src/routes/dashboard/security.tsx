import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/security')({
  beforeLoad: () => {
    throw redirect({ to: '/profile/security' })
  },
})
