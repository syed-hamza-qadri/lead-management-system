import React from 'react'
import { LucideIcon } from 'lucide-react'

interface InfoCardProps {
  icon: LucideIcon
  title: string
  description: string
  accentColor?: 'primary' | 'accent' | 'muted'
}

const colorClasses = {
  primary: 'from-primary/10 to-transparent border-primary/20',
  accent: 'from-accent/10 to-transparent border-accent/20',
  muted: 'from-muted/50 to-transparent border-muted/30',
}

export default function InfoCard({
  icon: Icon,
  title,
  description,
  accentColor = 'primary',
}: InfoCardProps) {
  return (
    <div className={`relative p-6 rounded-lg border bg-gradient-to-br ${colorClasses[accentColor]} backdrop-blur-sm`}>
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-background/50">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
