import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { generateAvatarUrl } from '@/lib/avatar'
import type { AvatarStyle } from '@/lib/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  image?: string | null
  name?: string | null
  userId?: string
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  avatarStyle?: AvatarStyle
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-16 w-16 text-lg',
}

export function UserAvatar({
  image,
  name,
  userId: _userId,
  className,
  size = 'md',
  avatarStyle = 'thumbs',
}: UserAvatarProps) {
  const avatarSeed = name || 'anonymous'
  const dicebearUrl = generateAvatarUrl(avatarSeed, avatarStyle)

  const initials = name
    ? name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  const imageUrl = image || dicebearUrl

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {imageUrl && <AvatarImage src={imageUrl} alt={name ?? 'User avatar'} />}
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
