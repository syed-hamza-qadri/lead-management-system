'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { useSession } from '@/lib/session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Edit2, LogOut, BarChart3 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Lead {
  id: string
  niche_id: string
  city_id: string
  data: Record<string, any>
  status: string
  created_at: string
}

interface Niche {
  id: string
  name: string
}

interface City {
  id: string
  name: string
  niche_id: string
}

export default function LeadGenerator() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()
  const { session, loading: sessionLoading } = useSession()

  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [filteredCities, setFilteredCities] = useState<City[]>([])

  const [openDialog, setOpenDialog] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [selectedNiche, setSelectedNiche] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [leadName, setLeadName] = useState('')
  const [leadDetails, setLeadDetails] = useState('')
  
  // Performance metrics
  const [performanceOpen, setPerformanceOpen] = useState(false)
  const [performance, setPerformance] = useState({ 
    added: 0, 
    approved: 0, 
    declined: 0, 
    scheduled: 0, 
    pending: 0,
    conversionRate: 0
  })
  
  // Lead details dialog
  const [selectedLeadForDetails, setSelectedLeadForDetails] = useState<any>(null)
  const [leadDetailsDialogOpen, setLeadDetailsDialogOpen] = useState(false)

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/portal')
      return
    }
    if (session) {
      fetchData()
    }
  }, [session, sessionLoading, router])

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
      if (!session?.user_id) {
        router.push('/portal')
        return
      }
      const userId = session.user_id

      const { data: nichesData } = await supabase
        .from('niches')
        .select('*')
        .order('name')

      const { data: citiesData } = await supabase
        .from('cities')
        .select('*')
        .order('name')

      // Filter leads to only show those created by current user
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      setNiches(nichesData || [])
      setCities(citiesData || [])
      // Limit leads to first 100 for initial load (pagination)
      setLeads((leadsData || []).slice(0, 100))

      // Calculate performance metrics for this lead generator
      let approved = 0, declined = 0, scheduled = 0
      const leadsWithAction = new Set<string>()
      
      // Get all responses for this generator's leads
      const leadIds = (leadsData || []).map((l: any) => l.id)
      if (leadIds.length > 0) {
        const { data: responses } = await supabase
          .from('lead_responses')
          .select('lead_id, action')
          .in('lead_id', leadIds)
        
        ;(responses || []).forEach((r: any) => {
          leadsWithAction.add(r.lead_id)
          if (r.action === 'approve') approved++
          else if (r.action === 'decline') declined++
          else if (r.action === 'later') scheduled++
        })
      }
      
      const pending = (leadsData || []).length - leadsWithAction.size
      const total = approved + declined + scheduled
      const conversionRate = total > 0 ? Math.round((approved / total) * 100) : 0
      
      setPerformance({
        added: (leadsData || []).length,
        approved,
        declined,
        scheduled,
        pending,
        conversionRate
      })
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

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedNiche || !selectedCity || !leadName || !leadDetails) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    try {
      const leadData = { name: leadName, details: leadDetails }
      
      if (isEditing && editingId) {
        // Update existing lead
        const { error } = await supabase
          .from('leads')
          .update({
            niche_id: selectedNiche,
            city_id: selectedCity,
            data: leadData,
          })
          .eq('id', editingId)

        if (error) {
          console.error('Supabase error (update):', error)
          throw new Error(error.message || 'Failed to update lead')
        }

        toast({
          title: 'Success',
          description: 'Lead updated successfully',
        })
        setIsEditing(false)
        setEditingId(null)
      } else {
        // Create new lead
        if (!session?.user_id) {
          throw new Error('Session not found')
        }
        const userId = session.user_id
        const { error } = await supabase
          .from('leads')
          .insert({
            niche_id: selectedNiche,
            city_id: selectedCity,
            data: leadData,
            status: 'unassigned',
            created_by: userId,
          })

        if (error) {
          console.error('Supabase error (insert):', error)
          throw new Error(error.message || 'Failed to create lead')
        }

        toast({
          title: 'Success',
          description: 'Lead created successfully',
        })
      }

      resetForm()
      setOpenDialog(false)
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      let errorMessage = 'Failed to save lead'
      
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String((error as any).message)
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const truncateDetails = (text: string, lines: number = 2) => {
    const lineArray = text.split('\n')
    if (lineArray.length > lines) {
      return lineArray.slice(0, lines).join('\n') + '...'
    }
    return text.length > 50 ? text.substring(0, 50) + '...' : text
  }

  const handleEditLead = (lead: Lead) => {
    setEditingId(lead.id)
    setIsEditing(true)
    setLeadName(lead.data.name || '')
    setLeadDetails(lead.data.details || '')
    
    // Set niche and city in sequence to allow filtering
    setSelectedNiche(lead.niche_id)
    setTimeout(() => {
      setSelectedCity(lead.city_id)
      setOpenDialog(true)
    }, 0)
  }

  const handleDeleteLead = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Lead deleted successfully',
      })
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete lead',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setSelectedNiche('')
    setSelectedCity('')
    setLeadName('')
    setLeadDetails('')
    setIsEditing(false)
    setEditingId(null)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/sessions', {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
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
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Lead Generator</h1>
            <p className="text-muted-foreground mt-2">Create and manage leads across niches and cities</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPerformanceOpen(true)} className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Status
            </Button>
            <Dialog open={openDialog} onOpenChange={(open) => {
              setOpenDialog(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Lead
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
                <DialogDescription>{isEditing ? 'Update lead information' : 'Create a new lead'}</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddLead} className="space-y-4">
                <div>
                  <Label htmlFor="niche" className="mb-2 block">Niche</Label>
                  <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                    <SelectTrigger id="niche">
                      <SelectValue placeholder="Select a niche" />
                    </SelectTrigger>
                    <SelectContent>
                      {niches.map(niche => (
                        <SelectItem key={niche.id} value={niche.id}>
                          {niche.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="city" className="mb-2 block">City</Label>
                  <Select value={selectedCity} onValueChange={setSelectedCity} disabled={!selectedNiche}>
                    <SelectTrigger id="city">
                      <SelectValue placeholder="Select a city" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCities.map(city => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="name" className="mb-2 block">Lead Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., John Doe"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="details" className="mb-2 block">Lead Details</Label>
                  <Textarea
                    id="details"
                    placeholder="e.g., email=johndoe@example.com&#10;phone=123-456-7890"
                    value={leadDetails}
                    onChange={(e) => setLeadDetails(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button type="submit" disabled={creating} className="w-full">
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isEditing ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    isEditing ? 'Update Lead' : 'Add Lead'
                  )}
                </Button>
              </form>
            </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Performance Dialog */}
        <Dialog open={performanceOpen} onOpenChange={setPerformanceOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Your Performance Metrics</DialogTitle>
              <DialogDescription>Overview of your performance and capacity</DialogDescription>
            </DialogHeader>
            
            <Card className="bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-1">
                <CardTitle className="text-base">{session?.user_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm pt-0">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Leads Added:</span>
                  <Badge variant="outline">{performance.added}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Approved:</span>
                  <Badge className="bg-green-100 text-green-700">{performance.approved || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Declined:</span>
                  <Badge className="bg-red-100 text-red-700">{performance.declined || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Scheduled:</span>
                  <Badge variant="outline">{performance.scheduled || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pending:</span>
                  <Badge className="bg-yellow-100 text-yellow-700">{performance.pending || 0}</Badge>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="font-semibold">Conversion Rate:</span>
                  <Badge className="bg-gray-100 text-gray-900">{performance.conversionRate}%</Badge>
                </div>
              </CardContent>
            </Card>
          </DialogContent>
        </Dialog>

        {/* Leads List */}
        <Card>
          <CardContent className="p-0">
            {leads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No leads created yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-6 py-3 font-semibold">Name</th>
                      <th className="text-left px-6 py-3 font-semibold">Niche</th>
                      <th className="text-left px-6 py-3 font-semibold">City</th>
                      <th className="text-left px-6 py-3 font-semibold">Details</th>
                      <th className="text-left px-6 py-3 font-semibold">Created At</th>
                      <th className="text-left px-6 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(lead => {
                      const niche = niches.find(n => n.id === lead.niche_id)
                      const city = cities.find(c => c.id === lead.city_id)
                      const createdDate = new Date(lead.created_at).toLocaleDateString()
                      return (
                        <tr key={lead.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4 font-medium cursor-pointer text-primary hover:underline" onClick={() => {
                            setSelectedLeadForDetails(lead)
                            setLeadDetailsDialogOpen(true)
                          }}>{lead.data.name}</td>
                          <td className="px-6 py-4 text-sm">{niche?.name}</td>
                          <td className="px-6 py-4 text-sm">{city?.name}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground whitespace-pre-wrap max-w-xs">{truncateDetails(lead.data.details)}</td>
                          <td className="px-6 py-4 text-sm">{createdDate}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditLead(lead)}
                                className="flex items-center gap-1"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteLead(lead.id)}
                                className="flex items-center gap-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Details Dialog */}
        <Dialog open={leadDetailsDialogOpen} onOpenChange={setLeadDetailsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">{selectedLeadForDetails?.data.name}</DialogTitle>
            </DialogHeader>
            {selectedLeadForDetails && (() => {
              const niche = niches.find(n => n.id === selectedLeadForDetails.niche_id)
              const city = cities.find(c => c.id === selectedLeadForDetails.city_id)
              const createdDate = new Date(selectedLeadForDetails.created_at).toLocaleDateString()
              return (
                <div className="space-y-6">
                  {/* Metadata */}
                  <div className="flex gap-6 flex-wrap pb-6 border-b">
                    {niche && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Niche</p>
                        <p className="text-base font-medium text-foreground">{niche.name}</p>
                      </div>
                    )}
                    {city && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">City</p>
                        <p className="text-base font-medium text-foreground">{city.name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</p>
                      <p className="text-base font-medium text-foreground">{createdDate}</p>
                    </div>
                    {selectedLeadForDetails.status && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
                        <p className="text-base font-medium text-foreground capitalize">{selectedLeadForDetails.status}</p>
                      </div>
                    )}
                  </div>

                  {/* Lead Details */}
                  <div className="space-y-8">
                    {selectedLeadForDetails.data && Object.keys(selectedLeadForDetails.data).length > 0 ? (
                      Object.entries(selectedLeadForDetails.data)
                        .filter(([key]) => key !== 'name')
                        .map(([key, value]) => {
                          const stringValue = String(value);
                          let parsedEntries: Array<[string, string]> = [];
                          
                          if (stringValue.includes('=') && stringValue.includes(',')) {
                            parsedEntries = stringValue.split(',').map(pair => {
                              const [k, v] = pair.split('=').map(s => s.trim());
                              return [k || '', v || ''] as [string, string];
                            }).filter(([k]) => k);
                          } else if (stringValue.includes('=') && !stringValue.includes(',')) {
                            const [k, v] = stringValue.split('=').map(s => s.trim());
                            if (k) {
                              parsedEntries = [[k, v || '']];
                            }
                          }
                          
                          if (parsedEntries.length > 0) {
                            return (
                              <div key={key}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {parsedEntries.map(([pKey, pValue]) => {
                                    const valueLines = pValue.includes(';') 
                                      ? pValue.split(';').map(v => v.trim()).filter(v => v)
                                      : [pValue];
                                    
                                    return (
                                      <div key={`${key}-${pKey}`} className="pb-4 border-b border-border last:border-b-0">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                                          {pKey.replace(/_/g, ' ')}
                                        </label>
                                        <div className="space-y-1">
                                          {valueLines.map((line, idx) => (
                                            <p key={idx} className="text-sm text-foreground leading-relaxed">
                                              {line}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                          
                          return (
                            <div key={key} className="pb-4 border-b border-border last:border-b-0">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                                {key.replace(/_/g, ' ')}
                              </label>
                              {stringValue.includes(';') ? (
                                <div className="space-y-1">
                                  {stringValue.split(';').map((line, idx) => (
                                    <p key={idx} className="text-sm text-foreground leading-relaxed">
                                      {line.trim()}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-foreground leading-relaxed">{stringValue}</p>
                              )}
                            </div>
                          );
                        })
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No lead details available</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
