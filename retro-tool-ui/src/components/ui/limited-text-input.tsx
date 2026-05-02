import { Input } from './input'
import { Label } from './label'

interface LimitedTextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  maxLength: number
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  showCount?: boolean
}

/**
 * Reusable input component with character limit and counter display.
 * Prevents input beyond the specified maxLength.
 */
export function LimitedTextInput({
  label,
  maxLength,
  value,
  onChange,
  showCount = true,
  ...props
}: LimitedTextInputProps) {
  const currentLength = value.length

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length <= maxLength) {
      onChange(e)
    }
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          {showCount && (
            <span className="text-xs text-muted-foreground">
              {currentLength} / {maxLength}
            </span>
          )}
        </div>
      )}
      <Input
        {...props}
        type="text"
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
      />
    </div>
  )
}
