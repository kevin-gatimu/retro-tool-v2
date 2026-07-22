import { createFileRoute, redirect } from '@tanstack/react-router'

// Legacy URL kept as a permanent redirect so old links and bookmarks
// keep working after the kebab-case route rename.
export const Route = createFileRoute('/termsofservice')({
  beforeLoad: () => {
    throw redirect({ to: '/terms-of-service', replace: true })
  },
})
