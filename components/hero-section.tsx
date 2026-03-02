import React from 'react'

interface HeroSectionProps {
  title: string
  subtitle: string
  children?: React.ReactNode
}

export default function HeroSection({ title, subtitle, children }: HeroSectionProps) {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-4">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground text-balance leading-tight tracking-tight">
          {title}
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto text-balance leading-relaxed">
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  )
}
