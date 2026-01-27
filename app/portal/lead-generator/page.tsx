'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, ArrowLeft, Edit2, LogOut } from 'lucide-react'
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
      setLeads(leadsData || [])
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
        const userId = localStorage.getItem('userId')
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/portal')}
            className="h-10 w-10 p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Lead Generator</h1>
            <p className="text-muted-foreground mt-2">Create and manage leads across niches and cities</p>
          </div>
          <div className="flex gap-2">
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
                      <th className="text-left px-6 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(lead => {
                      const niche = niches.find(n => n.id === lead.niche_id)
                      const city = cities.find(c => c.id === lead.city_id)
                      return (
                        <tr key={lead.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4 font-medium">{lead.data.name}</td>
                          <td className="px-6 py-4 text-sm">{niche?.name}</td>
                          <td className="px-6 py-4 text-sm">{city?.name}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground whitespace-pre-wrap">{lead.data.details}</td>
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
      </div>
    </main>
  )
}
