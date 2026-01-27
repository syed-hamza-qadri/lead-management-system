'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { getCallerLeads, getCallerNiches, getCallerCities } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, ChevronRight, LogOut } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Lead {
  id: string
  niche_id: string
  city_id: string
  data: Record<string, any>
  status: string
  assigned_to: string
  created_at: string
}

interface NicheData {
  id: string
  name: string
  description?: string
}

interface CityData {
  id: string
  name: string
  niche_id: string
}

export default function CallerPortal() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState<string>('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [niches, setNiches] = useState<NicheData[]>([])
  const [cities, setCities] = useState<CityData[]>([])
  const [filteredCities, setFilteredCities] = useState<CityData[]>([])

  const [view, setView] = useState<'niches' | 'cities' | 'leads'>('niches')
  const [selectedNiche, setSelectedNiche] = useState<string>('')
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const [actionStatus, setActionStatus] = useState('')
  const [responseNotes, setResponseNotes] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedNiche) {
      const filtered = cities.filter(c => c.niche_id === selectedNiche)
      setFilteredCities(filtered)
      setSelectedCity('')
    }
  }, [selectedNiche, cities])

  const fetchData = async () => {
    try {
      setLoading(true)
      const userId = localStorage.getItem('userId')
      const userName = localStorage.getItem('userName')
      if (!userId) {
        router.push('/portal')
        return
      }

      setUserName(userName || 'User')

      // Fetch caller's assigned niches, cities, and leads
      const [nichesData, citiesData, leadsData] = await Promise.all([
        getCallerNiches(userId),
        getCallerCities(userId),
        getCallerLeads(userId),
      ])

      const typedNiches: NicheData[] = (nichesData as any[]).map(n => ({
        id: n.id,
        name: n.name,
        description: n.description
      }))

      const typedCities: CityData[] = (citiesData as any[]).map(c => ({
        id: c.id,
        name: c.name,
        niche_id: c.niche_id
      }))

      setNiches(typedNiches)
      setCities(typedCities)
      setLeads(leadsData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTakeAction = async (action: string) => {
    if (!selectedLead || !action) {
      toast({
        title: 'Validation Error',
        description: 'Please select an action',
        variant: 'destructive',
      })
      return
    }

    setSubmittingAction(true)
    try {
      const userId = localStorage.getItem('userId')!
      
      // Create lead response
      const { error: responseError } = await supabase
        .from('lead_responses')
        .insert({
          lead_id: selectedLead.id,
          employee_id: userId,
          action: action,
          response_text: responseNotes,
          scheduled_for: action === 'schedule' ? new Date().toISOString() : null,
        })

      if (responseError) throw responseError

      // Update lead status
      const { error: updateError } = await supabase
        .from('leads')
        .update({ status: action })
        .eq('id', selectedLead.id)

      if (updateError) throw updateError

      // Log activity
      await supabase
        .from('activity_log')
        .insert({
          user_id: userId,
          action_type: `lead_${action}`,
          lead_id: selectedLead.id,
          description: `Caller ${action}ed lead: ${selectedLead.data.name}`,
        })

      toast({
        title: 'Success',
        description: `Lead ${action}ed successfully`,
      })

      setDetailsOpen(false)
      setResponseNotes('')
      setActionStatus('')
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: 'Error',
        description: 'Failed to process action',
        variant: 'destructive',
      })
    } finally {
      setSubmittingAction(false)
    }
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.data.name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCity = !selectedCity || lead.city_id === selectedCity

    return matchesSearch && matchesCity
  })

  const handleLogout = async () => {
    try {
      await fetch('/api/sessions/validate', {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('employee_user')
      localStorage.removeItem('userId')
      toast({
        title: 'Logged Out',
        description: 'You have been logged out successfully',
      })
      router.push('/portal')
    }
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Your Leads</h1>
            <p className="text-muted-foreground mt-2">Welcome, {userName}. Select a niche to view available leads</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        {/* Niches Section - Card View */}
        <div className="space-y-4 mb-8">
          {niches.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No niches assigned yet. Contact your manager to assign niches.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {niches.map(niche => (
                <Card
                  key={niche.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedNiche(niche.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{niche.name}</CardTitle>
                    <CardDescription>{niche.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {cities.filter(c => c.niche_id === niche.id).length} cities
                      </span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${selectedNiche === niche.id ? 'rotate-90' : ''}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Cities Section - Card View (filtered by selected niche) */}
        {selectedNiche && (
          <div className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">
              Cities in {niches.find(n => n.id === selectedNiche)?.name}
            </h2>
            {filteredCities.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">No cities in this niche.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCities.map(city => (
                  <Card
                    key={city.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => router.push(`/portal/city/${city.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{city.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {leads.filter(l => l.city_id === city.id).length} leads
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leads Section removed - users navigate via /portal/city/[id] */}

        {/* Lead Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Lead Details</DialogTitle>
              <DialogDescription>Review and take action on this lead</DialogDescription>
            </DialogHeader>

            {selectedLead && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <p className="text-foreground mt-1">{selectedLead.data.name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-foreground mt-1">{selectedLead.data.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <p className="text-foreground mt-1">{selectedLead.data.phone}</p>
                </div>

                {selectedLead.data.message && (
                  <div>
                    <label className="text-sm font-medium">Message</label>
                    <p className="text-foreground mt-1 text-sm">{selectedLead.data.message}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium block mb-2">Take Action</label>
                  <div className="space-y-2">
                    <Button
                      variant={actionStatus === 'approved' ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => setActionStatus('approved')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant={actionStatus === 'declined' ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => setActionStatus('declined')}
                    >
                      Decline
                    </Button>
                    <Button
                      variant={actionStatus === 'schedule' ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => setActionStatus('schedule')}
                    >
                      Schedule Follow-up
                    </Button>
                  </div>
                </div>

                {actionStatus && (
                  <div>
                    <label className="text-sm font-medium block mb-2">Response Notes (Optional)</label>
                    <textarea
                      placeholder="Add notes about this lead..."
                      value={responseNotes}
                      onChange={(e) => setResponseNotes(e.target.value)}
                      className="w-full p-2 border rounded text-sm"
                      rows={3}
                    />
                  </div>
                )}

                {actionStatus && (
                  <Button
                    onClick={() => handleTakeAction(actionStatus)}
                    disabled={submittingAction}
                    className="w-full"
                  >
                    {submittingAction ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Confirm ${actionStatus}`
                    )}
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
