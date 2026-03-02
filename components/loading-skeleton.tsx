import React from 'react'

export default function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="h-8 bg-secondary rounded-lg animate-pulse w-3/4" />
          <div className="h-4 bg-secondary rounded-lg animate-pulse w-1/2" />
        </div>

        {/* Card skeleton */}
        <div className="space-y-4 p-6 rounded-lg border border-border/60 bg-card/80 backdrop-blur-sm">
          <div className="h-6 bg-secondary rounded animate-pulse w-2/3" />
          <div className="h-4 bg-secondary rounded animate-pulse w-full" />
          <div className="h-4 bg-secondary rounded animate-pulse w-5/6" />
          <div className="h-10 bg-primary/20 rounded animate-pulse w-full mt-6" />
        </div>
      </div>
    </main>
  )
}
