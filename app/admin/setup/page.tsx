'use client'

import React from "react"
import { useEffect, useState } from 'react'
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, ArrowLeft, Edit2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Niche {
  id: string
  name: string
}

interface City {
  id: string
  name: string
  niche_id: string
  niche_name?: string
}

interface Lead {
  id: string
  niche_id: string
  city_id: string
  data: Record<string, any>
}

export default function SetupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()
  const { session, loading: sessionLoading } = useSession()

  // Niche States
  const [niches, setNiches] = useState<Niche[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/')
      return
    }
    if (sessionLoading) return
    
    // Check if user role is admin
    if (session && session.user_role !== 'admin') {
      router.push('/')
      return
    }

    if (session?.user_role === 'admin') {
      fetchData()
    }
  }, [session, sessionLoading, router])

  // Dialog States
  const [nicheDialog, setNicheDialog] = useState(false)
  const [cityDialog, setCityDialog] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmType, setDeleteConfirmType] = useState<'niche' | 'city' | 'lead' | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [leadDialog, setLeadDialog] = useState(false)

  // Form States
  const [nicheName, setNicheName] = useState('')
  const [cityName, setCityName] = useState('')
  const [selectedNiche, setSelectedNiche] = useState('')
  const [leadName, setLeadName] = useState('')
  const [selectedLeadNiche, setSelectedLeadNiche] = useState('')
  const [selectedLeadCity, setSelectedLeadCity] = useState('')
  const [leadDetails, setLeadDetails] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Edit States
  const [editingNicheId, setEditingNicheId] = useState<string | null>(null)
  const [editingCityId, setEditingCityId] = useState<string | null>(null)
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)

  const resetForm = () => {
    setNicheName('')
    setCityName('')
    setLeadName('')
    setLeadDetails('')
    setSelectedNiche('')
    setSelectedLeadNiche('')
    setSelectedLeadCity('')
    setEditingNicheId(null)
    setEditingCityId(null)
    setEditingLeadId(null)
  }

  const fetchData = async () => {
    try {
      const [nicheRes, cityRes, leadRes] = await Promise.all([
        supabase.from('niches').select('*').order('name'),
        supabase.from('cities').select('*').order('name'),
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(100), // Pagination
      ])

      setNiches(nicheRes.data || [])

      // Enrich cities with niche names
      if (cityRes.data) {
        const enrichedCities = (cityRes.data || []).map((city: any) => {
          const niche = (nicheRes.data || []).find((n: any) => n.id === city.niche_id)
          return {
            ...city,
            niche_name: niche?.name || 'Unknown',
          }
        })
        setCities(enrichedCities)
      }

      setLeads((leadRes.data || []).slice(0, 100)) // Ensure max 100 leads
    } catch (error) {
      console.error('[v0] Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // fetchData is already called in the session validation useEffect above

  const handleAddNiche = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nicheName) return

    // If editing, use update handler
    if (editingNicheId) {
      handleUpdateNiche(e)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('niches')
        .insert({ name: nicheName })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Niche added successfully',
      })
      setNicheName('')
      setNicheDialog(false)

      // Refresh data
      fetchData()
    } catch (error) {
      console.error('[v0] Error adding niche:', error)
      toast({
        title: 'Error',
        description: 'Failed to add niche',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cityName || !selectedNiche) {
      toast({
        title: 'Validation Error',
        description: 'Please select a niche and enter a city name',
        variant: 'destructive',
      })
      return
    }

    // If editing, use update handler
    if (editingCityId) {
      handleUpdateCity(e)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('cities')
        .insert({
          name: cityName,
          niche_id: selectedNiche,
        })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'City added successfully',
      })
      setCityName('')
      setSelectedNiche('')
      setCityDialog(false)
      fetchData()
    } catch (error) {
      console.error('[v0] Error adding city:', error)
      toast({
        title: 'Error',
        description: 'Failed to add city',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadName || !selectedLeadNiche || !selectedLeadCity) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all fields',
        variant: 'destructive',
      })
      return
    }

    // If editing, use update handler
    if (editingLeadId) {
      handleUpdateLead(e)
      return
    }

    setSaving(true)
    try {
      // Parse lead details using key=value format
      const detailsObj: Record<string, any> = {}
      if (leadDetails.trim()) {
        leadDetails.split('\n').forEach((line) => {
          const trimmedLine = line.trim()
          if (!trimmedLine) return
          
          const [key, ...valueParts] = trimmedLine.split('=')
          if (key && key.trim() && valueParts.length > 0) {
            const trimmedKey = key.trim()
            const trimmedValue = valueParts.join('=').trim()
            if (trimmedValue) {
              detailsObj[trimmedKey] = trimmedValue
            }
          }
        })
      }

      // Prepare data object with name included
      const leadData = {
        name: leadName,
        ...detailsObj,
      }

      const { error } = await supabase
        .from('leads')
        .insert({
          niche_id: selectedLeadNiche,
          city_id: selectedLeadCity,
          data: leadData,
          status: 'unassigned',
        })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Lead added successfully',
      })
      setLeadName('')
      setLeadDetails('')
      setSelectedLeadNiche('')
      setSelectedLeadCity('')
      setLeadDialog(false)
      fetchData()
    } catch (error) {
      console.error('[v0] Error adding lead:', error)
      toast({
        title: 'Error',
        description: 'Failed to add lead',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const parseLeadDetails = (details: string): Record<string, any> => {
    const lines = details.trim().split('\n').filter(line => line.trim())
    const parsedDetails: Record<string, any> = {}

    lines.forEach((line) => {
      const trimmedLine = line.trim()
      if (!trimmedLine) return // Skip empty lines

      const [key, ...valueParts] = trimmedLine.split('=')
      
      // Validate that we have both key and value
      if (!key || !key.trim() || valueParts.length === 0) {
        console.warn(`[v0] Invalid detail format: "${trimmedLine}". Use "key=value" format.`)
        return
      }

      const trimmedKey = key.trim()
      const trimmedValue = valueParts.join('=').trim() // Rejoin in case value contains '='

      if (trimmedKey && trimmedValue) {
        parsedDetails[trimmedKey] = trimmedValue
      }
    })

    return parsedDetails
  }

  const handleEditNiche = (niche: Niche) => {
    setNicheName(niche.name)
    setEditingNicheId(niche.id)
    setNicheDialog(true)
  }

  const handleUpdateNiche = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nicheName || !editingNicheId) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('niches')
        .update({ name: nicheName })
        .eq('id', editingNicheId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Niche updated successfully',
      })
      setNicheName('')
      setEditingNicheId(null)
      setNicheDialog(false)
      fetchData()
    } catch (error) {
      console.error('[v0] Error updating niche:', error)
      toast({
        title: 'Error',
        description: 'Failed to update niche',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNiche = async (nicheId: string) => {
    setDeleteItemId(nicheId)
    setDeleteConfirmType('niche')
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteNiche = async () => {
    if (!deleteItemId) return
    try {
      await supabase.from('niches').delete().eq('id', deleteItemId)
      toast({
        title: 'Success',
        description: 'Niche deleted successfully',
      })

      const { data } = await supabase.from('niches').select('*').order('name')
      setNiches(data || [])
      setDeleteConfirmOpen(false)
      setDeleteItemId(null)
    } catch (error) {
      console.error('[v0] Error deleting niche:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete niche',
        variant: 'destructive',
      })
      setDeleteConfirmOpen(false)
      setDeleteItemId(null)
    }
  }

  const handleEditCity = (city: City) => {
    setCityName(city.name)
    setSelectedNiche(city.niche_id)
    setEditingCityId(city.id)
    setCityDialog(true)
  }

  const handleUpdateCity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cityName || !selectedNiche || !editingCityId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a niche and enter a city name',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('cities')
        .update({ name: cityName, niche_id: selectedNiche })
        .eq('id', editingCityId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'City updated successfully',
      })
      setCityName('')
      setSelectedNiche('')
      setEditingCityId(null)
      setCityDialog(false)
      fetchData()
    } catch (error) {
      console.error('[v0] Error updating city:', error)
      toast({
        title: 'Error',
        description: 'Failed to update city',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCity = async (cityId: string) => {
    setDeleteItemId(cityId)
    setDeleteConfirmType('city')
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteCity = async () => {
    if (!deleteItemId) return
    try {
      await supabase.from('cities').delete().eq('id', deleteItemId)
      toast({
        title: 'Success',
        description: 'City deleted successfully',
      })

      const { data } = await supabase.from('cities').select('*').order('name')
      setCities(
        (data || []).map((city: any) => {
          const niche = niches.find((n: any) => n.id === city.niche_id)
          return {
            ...city,
            niche_name: niche?.name || 'Unknown',
          }
        })
      )
      setDeleteConfirmOpen(false)
      setDeleteItemId(null)
    } catch (error) {
      console.error('[v0] Error deleting city:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete city',
        variant: 'destructive',
      })
      setDeleteConfirmOpen(false)
      setDeleteItemId(null)
    }
  }

  const handleEditLead = (lead: Lead) => {
    setLeadName(lead.data?.name || '')
    setSelectedLeadNiche(lead.niche_id)
    setSelectedLeadCity(lead.city_id)
    
    // Reconstruct details from data (excluding name) using key=value format
    const details = { ...lead.data }
    delete details.name
    setLeadDetails(Object.entries(details).map(([k, v]) => `${k}=${v}`).join('\n'))
    
    setEditingLeadId(lead.id)
    setLeadDialog(true)
  }

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadName || !selectedLeadNiche || !selectedLeadCity || !editingLeadId) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all fields',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      // Parse lead details using key=value format
      const detailsObj: Record<string, any> = {}
      if (leadDetails.trim()) {
        leadDetails.split('\n').forEach((line) => {
          const trimmedLine = line.trim()
          if (!trimmedLine) return
          
          const [key, ...valueParts] = trimmedLine.split('=')
          if (key && key.trim() && valueParts.length > 0) {
            const trimmedKey = key.trim()
            const trimmedValue = valueParts.join('=').trim()
            if (trimmedValue) {
              detailsObj[trimmedKey] = trimmedValue
            }
          }
        })
      }

      const leadData = {
        name: leadName,
        ...detailsObj,
      }

      const { error } = await supabase
        .from('leads')
        .update({
          niche_id: selectedLeadNiche,
          city_id: selectedLeadCity,
          data: leadData,
        })
        .eq('id', editingLeadId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Lead updated successfully',
      })
      setLeadName('')
      setLeadDetails('')
      setSelectedLeadNiche('')
      setSelectedLeadCity('')
      setEditingLeadId(null)
      setLeadDialog(false)
      fetchData()
    } catch (error) {
      console.error('[v0] Error updating lead:', error)
      toast({
        title: 'Error',
        description: 'Failed to update lead',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    setDeleteItemId(leadId)
    setDeleteConfirmType('lead')
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteLead = async () => {
    if (!deleteItemId) return
    try {
      await supabase.from('leads').delete().eq('id', deleteItemId)
      toast({
        title: 'Success',
        description: 'Lead deleted successfully',
      })

      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
      setLeads(data || [])
      setDeleteConfirmOpen(false)
      setDeleteItemId(null)
    } catch (error) {
      console.error('[v0] Error deleting lead:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete lead',
        variant: 'destructive',
      })
      setDeleteConfirmOpen(false)
      setDeleteItemId(null)
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
            onClick={() => router.push('/admin')}
            className="h-10 w-10 p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Setup & Manage Data</h1>
            <p className="text-muted-foreground mt-2">Add niches, cities, and leads to your system</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="niches" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="niches">Niches</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
          </TabsList>

          {/* Niches Tab */}
          <TabsContent value="niches">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Manage Niches</CardTitle>
                  <CardDescription>Create and organize business niches</CardDescription>
                </div>
                <Dialog open={nicheDialog} onOpenChange={(open) => {
                  setNicheDialog(open)
                  if (!open) resetForm()
                }}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add Niche
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingNicheId ? 'Edit Niche' : 'Add New Niche'}</DialogTitle>
                      <DialogDescription>{editingNicheId ? 'Update niche information' : 'Create a new business niche category'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddNiche} className="space-y-4">
                      <div>
                        <Label htmlFor="niche-name" className="mb-2 block">Niche Name</Label>
                        <Input
                          id="niche-name"
                          placeholder="e.g., Real Estate, Software Services"
                          value={nicheName}
                          onChange={(e) => setNicheName(e.target.value)}
                        />
                      </div>
                      <Button type="submit" disabled={saving} className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {editingNicheId ? 'Save Niche' : 'Add Niche'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {niches.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No niches yet</p>
                ) : (
                  <div className="space-y-2">
                    {niches.map((niche: any) => (
                      <div
                        key={niche.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                      >
                        <span className="font-medium">{niche.name}</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditNiche(niche)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteNiche(niche.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cities Tab */}
          <TabsContent value="cities">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Manage Cities</CardTitle>
                  <CardDescription>Create and organize cities within niches</CardDescription>
                </div>
                <Dialog open={cityDialog} onOpenChange={(open) => {
                  setCityDialog(open)
                  if (!open) resetForm()
                }}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add City
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingCityId ? 'Edit City' : 'Add New City'}</DialogTitle>
                      <DialogDescription>{editingCityId ? 'Update city information' : 'Create a new city in a niche'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddCity} className="space-y-4">
                      <div>
                        <Label htmlFor="city-name" className="mb-2 block">City Name</Label>
                        <Input
                          id="city-name"
                          placeholder="e.g., New York, London"
                          value={cityName}
                          onChange={(e) => setCityName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="niche-select" className="mb-2 block">Select Niche</Label>
                        <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a niche" />
                          </SelectTrigger>
                          <SelectContent>
                            {niches.map((niche: any) => (
                              <SelectItem key={niche.id} value={niche.id}>
                                {niche.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" disabled={saving} className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {editingCityId ? 'Save City' : 'Add City'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {cities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No cities yet</p>
                ) : (
                  <div className="space-y-2">
                    {cities.map((city: any) => (
                      <div
                        key={city.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{city.name}</p>
                          <p className="text-sm text-muted-foreground">{city.niche_name}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCity(city)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteCity(city.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Manage Leads</CardTitle>
                  <CardDescription>Create and manage leads within cities</CardDescription>
                </div>
                <Dialog open={leadDialog} onOpenChange={(open) => {
                  setLeadDialog(open)
                  if (!open) resetForm()
                }}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add Lead
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingLeadId ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
                      <DialogDescription>{editingLeadId ? 'Update lead information' : 'Create a new lead within a city'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddLead} className="space-y-4">
                      <div>
                        <Label htmlFor="lead-name" className="mb-2 block">Lead Name</Label>
                        <Input
                          id="lead-name"
                          placeholder="e.g., John Doe"
                          value={leadName}
                          onChange={(e) => setLeadName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="lead-niche-select" className="mb-2 block">Select Niche</Label>
                        <Select value={selectedLeadNiche} onValueChange={setSelectedLeadNiche}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a niche" />
                          </SelectTrigger>
                          <SelectContent>
                            {niches.map((niche) => (
                              <SelectItem key={niche.id} value={niche.id}>
                                {niche.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="lead-city-select" className="mb-2 block">Select City</Label>
                        <Select value={selectedLeadCity} onValueChange={setSelectedLeadCity}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a city" />
                          </SelectTrigger>
                          <SelectContent>
                            {cities.map((city: any) => (
                              <SelectItem key={city.id} value={city.id}>
                                {city.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="lead-details" className="mb-2 block">Lead Details</Label>
                        <Textarea
                          id="lead-details"
                          placeholder="e.g., email=johndoe@example.com&#10;phone=123-456-7890"
                          value={leadDetails}
                          onChange={(e) => setLeadDetails(e.target.value)}
                        />
                      </div>
                      <Button type="submit" disabled={saving} className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {editingLeadId ? 'Save Lead' : 'Add Lead'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {leads.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No leads yet</p>
                ) : (
                  <div className="space-y-2">
                    {leads.map((lead: any) => (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{lead.data?.name || 'Lead'}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {Object.entries(lead.data || {})
                              .filter(([key]) => key !== 'name')
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' • ')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditLead(lead)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteLead(lead.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {deleteConfirmType === 'niche' ? 'Niche' : deleteConfirmType === 'city' ? 'City' : 'Lead'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteConfirmType === 'niche' && 'Delete this niche? All associated data will be removed.'}
                {deleteConfirmType === 'city' && 'Delete this city? All associated leads will be removed.'}
                {deleteConfirmType === 'lead' && 'Delete this lead? This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirmType === 'niche') confirmDeleteNiche()
                  else if (deleteConfirmType === 'city') confirmDeleteCity()
                  else if (deleteConfirmType === 'lead') confirmDeleteLead()
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  )
}
