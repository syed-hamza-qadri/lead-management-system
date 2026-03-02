'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, RefreshCw, ArrowLeft } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  showBackButton?: boolean
  onLogout?: () => void
  onRefresh?: () => void
  refreshing?: boolean
  actionButtons?: React.ReactNode
}

export default function Header({
  title,
  subtitle,
  showBackButton = false,
  onLogout,
  onRefresh,
  refreshing = false,
  actionButtons,
}: HeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left Section */}
          <div className="flex items-center gap-4 flex-1">
            {showBackButton && (
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground truncate">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right Section - Action Buttons */}
          <div className="flex items-center gap-2">
            {actionButtons}
            {onRefresh && (
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={refreshing}
                title="Refresh data"
                className="border-border/60"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
            {onLogout && (
              <Button
                variant="outline"
                size="icon"
                onClick={onLogout}
                title="Log out"
                className="border-border/60"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
