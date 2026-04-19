import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/templates')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/templates"!</div>
}
