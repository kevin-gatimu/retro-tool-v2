import { createFileRoute, redirect } from '@tanstack/react-router'

// Legacy URL kept as a permanent redirect so old links and bookmarks
// keep working after the kebab-case route rename.
export const Route = createFileRoute('/privacystatement')({
  beforeLoad: () => {
    throw redirect({ to: '/privacy-statement', replace: true })
  },
})
