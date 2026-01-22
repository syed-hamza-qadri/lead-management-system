'use client'

import React from "react"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, LogOut } from 'lucide-react'

interface Niche {
  id: string
  name: string
  lead_count: number
}

interface User {
  id: string
  name: string
  email: string
}

export default function PortalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [niches, setNiches] = useState<Niche[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const supabase = getSupabaseClient()

  // Check if user is already logged in
  useEffect(() => {
    const sessionToken = localStorage.getItem('session_token')
    const sessionUser = localStorage.getItem('employee_user')
    if (sessionToken && sessionUser) {
      setUser(JSON.parse(sessionUser))
      setIsLoggedIn(true)
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const fetchNiches = async () => {
      if (!isLoggedIn) return
      
      try {
        const { data, error } = await supabase
          .from('niches')
          .select('id, name')
          .order('name')

        if (error) throw error

        // Get lead counts
        if (data) {
          const nichesWithCounts = await Promise.all(
            data.map(async (niche: any) => {
              const { count } = await supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('niche_id', niche.id)

              return {
                ...niche,
                lead_count: count || 0,
              }
            })
          )
          setNiches(nichesWithCounts)
        }
      } catch (error) {
        console.error('[v0] Error fetching niches:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNiches()
  }, [supabase, isLoggedIn])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      const response = await fetch('/api/employee/login', {
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
          description: data.error || 'Invalid email or password',
          variant: 'destructive',
        })
        setLoginError(data.error || 'Login failed')
        return
      }

      // Store session
      localStorage.setItem('session_token', data.token)
      localStorage.setItem('employee_user', JSON.stringify(data.user))

      toast({
        title: 'Login Successful',
        description: `Welcome, ${data.user.name}!`,
      })

      setUser(data.user)
      setIsLoggedIn(true)
      setName('')
      setPassword('')
    } catch (error) {
      console.error('[v0] Login error:', error)
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

  const handleLogout = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token')
      if (sessionToken) {
        // Delete session from backend
        await fetch('/api/sessions/validate', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('session_token')
      localStorage.removeItem('employee_user')
      setUser(null)
      setIsLoggedIn(false)
      setNiches([])
      toast({
        title: 'Logged Out',
        description: 'You have been logged out successfully',
      })
      router.push('/')
    }
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Portal Login</CardTitle>
            <CardDescription>Sign in to access leads</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Name</label>
                <Input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loginLoading}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Password</label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginLoading}
                  required
                />
              </div>
              {loginError && <p className="text-sm text-destructive">{loginError}</p>}
              <Button type="submit" disabled={loginLoading} className="w-full">
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Leads</h1>
            <p className="text-muted-foreground mt-2">Welcome, {user?.name}. Select a niche to view available leads</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {niches.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No niches available yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {niches.map((niche: any) => (
              <Card
                key={niche.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/portal/niche/${niche.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{niche.name}</CardTitle>
                    <Badge variant="secondary">{niche.lead_count} leads</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Click to view cities and leads</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
