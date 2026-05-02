import * as React from 'react'

import { cn } from '#/lib/utils'

interface InputProps extends React.ComponentProps<'input'> {
  maxCharacters?: number
  showCharCount?: boolean
}

function Input({
  className,
  type,
  maxCharacters,
  showCharCount = true,
  value,
  onChange,
  ...props
}: InputProps) {
  const currentLength = typeof value === 'string' ? value.length : 0

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (maxCharacters && e.target.value.length <= maxCharacters) {
      onChange?.(e)
    } else if (!maxCharacters) {
      onChange?.(e)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        type={type}
        data-slot="input"
        className={cn(
          'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
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

export { Input }
