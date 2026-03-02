import React from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertCircle, XCircle, Zap } from 'lucide-react'

interface StatusBadgeProps {
  status: 'success' | 'pending' | 'warning' | 'error' | 'active'
  label: string
  showIcon?: boolean
}

const statusConfig = {
  success: {
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  },
  pending: {
    icon: Clock,
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  },
  warning: {
    icon: AlertCircle,
    className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  },
  error: {
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  },
  active: {
    icon: Zap,
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  },
}

export default function StatusBadge({ status, label, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`${config.className} gap-1.5`}>
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </Badge>
  )
}
