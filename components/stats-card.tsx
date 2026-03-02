import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  variant?: 'default' | 'accent' | 'muted'
  onClick?: () => void
}

export default function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
  onClick,
}: StatsCardProps) {
  const variantClasses = {
    default: 'hover:shadow-md',
    accent: 'border-primary/20 bg-gradient-to-br from-primary/5 to-transparent hover:shadow-md hover:border-primary/40',
    muted: 'bg-secondary/50',
  }

  return (
    <Card
      className={`relative overflow-hidden border-border/60 transition-all duration-300 ${
        onClick ? 'cursor-pointer' : ''
      } ${variantClasses[variant]}`}
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-transparent opacity-0 hover:opacity-5 transition-opacity duration-300" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {Icon && (
            <Icon className="w-5 h-5 text-primary/60 flex-shrink-0" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="text-3xl font-bold text-foreground">{value}</div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
