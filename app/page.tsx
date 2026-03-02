'use client'

import React from "react"
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { prePopulateSessionCache } from '@/lib/session'
import { Lock, Users, ArrowRight, Briefcase } from 'lucide-react'
import Footer from '@/components/footer'

export default function Home() {
  const router = useRouter()
  const [adminPassword, setAdminPassword] = useState('')
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [error, setError] = useState('')

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: adminPassword }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Incorrect password')
        setAdminPassword('')
        return
      }

      const data = await response.json()

      if (data.session) {
        prePopulateSessionCache(data.session)
      }

      router.replace('/admin')
    } catch (err) {
      setError('Login failed')
      setAdminPassword('')
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-white font-bold text-lg">LMS</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Lead Management</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
              Lead Management System
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Professional lead management solution for efficient sales operations and real-time team collaboration
            </p>
          </div>

          {/* Portal Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Employee Portal Card */}
            <Card 
              className="group relative border border-border/60 overflow-hidden hover:border-primary/40 transition-all duration-300 cursor-pointer backdrop-blur-sm bg-card/80 hover:shadow-lg"
              onClick={() => router.push('/portal')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative z-10">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <CardTitle className="text-2xl">Employee Portal</CardTitle>
                    <CardDescription>Access your workspace</CardDescription>
                  </div>
                  <Users className="w-6 h-6 text-primary/60" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10 space-y-6">
                <p className="text-muted-foreground leading-relaxed">
                  Browse quality leads by niche and location, track interactions, and manage your sales pipeline
                </p>
                <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
                  <span>Enter Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            {/* Admin Portal Card */}
            <Card 
              className="group relative border border-border/60 overflow-hidden cursor-pointer transition-all duration-300 backdrop-blur-sm bg-card/80 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative z-10">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <CardTitle className="text-2xl">Admin Panel</CardTitle>
                    <CardDescription>System administration</CardDescription>
                  </div>
                  <Lock className="w-6 h-6 text-primary/60" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10 space-y-6">
                {!showAdminForm ? (
                  <div className="space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Manage users, monitor activity logs, and control system settings
                    </p>
                    <button
                      onClick={() => setShowAdminForm(true)}
                      className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all"
                    >
                      <span>Access Admin</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-2">Admin Password</label>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        value={adminPassword}
                        onChange={(e) => {
                          setAdminPassword(e.target.value)
                          setError('')
                        }}
                        className="bg-input/50 border-border/60 text-foreground placeholder:text-muted-foreground/50"
                        autoFocus
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive font-medium">{error}</p>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        type="submit" 
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        Login
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowAdminForm(false)
                          setAdminPassword('')
                          setError('')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          <Footer />
        </div>
      </div>
    </main>
  )
}
