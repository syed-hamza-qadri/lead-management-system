'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border border-border/60 backdrop-blur-sm bg-card/80">
          <CardContent className="p-8 text-center space-y-8">
            <div className="flex justify-center">
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-primary" />
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold">
                  404
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-bold text-foreground">Page Not Found</h1>
              <p className="text-muted-foreground">
                The page you're looking for doesn't exist or has been moved. Let's get you back on track.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Link href="/" className="w-full">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </Link>
              <Link href="/portal" className="w-full">
                <Button variant="outline" className="w-full border-border/60">
                  Go to Portal
                </Button>
              </Link>
            </div>

            <div className="pt-4 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                If you believe this is a mistake, please contact support
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
