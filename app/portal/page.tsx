'use client'

import React from "react"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ArrowLeft } from 'lucide-react'
import { prePopulateSessionCache } from '@/lib/session'
import Footer from '@/components/footer'

export default function PortalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    const validateAndRoute = async () => {
      try {
        const response = await fetch('/api/sessions/validate', {
          credentials: 'include',
        })

        if (response.ok) {
          const sessionData = await response.json()
          if (sessionData.user_role === 'admin') {
            router.replace('/admin')
          } else if (sessionData.user_role === 'manager') {
            router.replace('/portal/manager')
          } else if (sessionData.user_role === 'lead_generator') {
            router.replace('/portal/lead-generator')
          } else if (sessionData.user_role === 'caller') {
            router.replace('/portal/caller')
          }
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('[Portal] Session validation error:', error)
        setLoading(false)
      }
    }

    validateAndRoute()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      const response = await fetch('/api/portal/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: 'Login Failed',
          description: data.error || 'Invalid credentials',
          variant: 'destructive',
        })
        setLoginError(data.error || 'Login failed')
        return
      }

      toast({
        title: 'Login Successful',
        description: `Welcome, ${data.user.name}!`,
      })

      if (data.session) {
        prePopulateSessionCache(data.session)
      }

      const role = data.user.role
      if (role === 'admin') {
        router.replace('/admin')
      } else if (role === 'manager') {
        router.replace('/portal/manager')
      } else if (role === 'lead_generator') {
        router.replace('/portal/lead-generator')
      } else if (role === 'caller') {
        router.replace('/portal/caller')
      }
    } catch (error) {
      console.error('[Portal] Login error:', error)
      toast({
        title: 'Error',
        description: 'An error occurred during login',
        variant: 'destructive',
      })
      setLoginError('An error occurred during login')
    } finally {
      setLoginLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex flex-col items-center justify-center p-4">
      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      <div className="w-full max-w-md flex flex-col h-full">
        <Card className="border border-border/60 backdrop-blur-sm bg-card/80 flex-1 flex flex-col">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Employee Portal</CardTitle>
            <CardDescription>Sign in to access your workspace</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Name</label>
                <Input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loginLoading}
                  className="bg-input/50 border-border/60 text-foreground placeholder:text-muted-foreground/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginLoading}
                  className="bg-input/50 border-border/60 text-foreground placeholder:text-muted-foreground/50"
                  required
                />
              </div>
              {loginError && (
                <p className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md">
                  {loginError}
                </p>
              )}
              <Button 
                type="submit" 
                disabled={loginLoading} 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-10"
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-auto pt-6 border-t border-border/40">
              <p className="text-xs text-muted-foreground text-center">
                Secure login for authorized users only
              </p>
            </div>
          </CardContent>
        </Card>
        <Footer />
      </div>
    </main>
  )
}
