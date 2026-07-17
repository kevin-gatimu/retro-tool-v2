import { BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function EmptyReportState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-center text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
