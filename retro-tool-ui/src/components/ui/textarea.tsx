import * as React from 'react'

import { cn } from '#/lib/utils'

interface TextareaProps extends React.ComponentProps<'textarea'> {
  maxCharacters?: number
  showCharCount?: boolean
}

function Textarea({
  className,
  maxCharacters,
  showCharCount = true,
  value,
  onChange,
  ...props
}: TextareaProps) {
  const currentLength = typeof value === 'string' ? value.length : 0

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (maxCharacters && e.target.value.length <= maxCharacters) {
      onChange?.(e)
    } else if (!maxCharacters) {
      onChange?.(e)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        data-slot="textarea"
        className={cn(
          'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40',
          className,
        )}
        value={value}
        onChange={handleChange}
        maxLength={maxCharacters}
        {...props}
      />
      {maxCharacters && showCharCount && (
        <span className="text-xs text-muted-foreground">
          {currentLength} / {maxCharacters}
        </span>
      )}
    </div>
  )
}

export { Textarea }
