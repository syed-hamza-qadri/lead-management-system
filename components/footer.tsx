import React from 'react'

interface FooterProps {
  text?: string
}

export default function Footer({ text = 'Secure lead management platform for professional sales teams' }: FooterProps) {
  return (
    <footer className="mt-auto pt-8 border-t border-border/40">
      <div className="flex items-center justify-center">
        <p className="text-xs text-muted-foreground text-center">
          {text}
        </p>
      </div>
    </footer>
  )
}
