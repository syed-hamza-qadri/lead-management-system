'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ArrowLeft, ChevronRight } from 'lucide-react'

interface Lead {
  id: string
  data: Record<string, any>
  status: string
  created_at: string
  scheduled_for?: string
}

interface LeadWithSchedule extends Lead {
  daysRemaining?: number
}

export default function LeadList() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const cityId = params.id as string
  const [leads, setLeads] = useState<LeadWithSchedule[]>([])
  const [cityName, setCityName] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        // Get city name
        const { data: cityData, error: cityError } = await supabase
          .from('cities')
          .select('name')
          .eq('id', cityId)
          .single()

        if (cityError) throw cityError
        setCityName(cityData?.name || '')

        // Get leads for this city
        const { data, error } = await supabase
          .from('leads')
          .select('id, data, status, created_at')
          .eq('city_id', cityId)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Enrich leads with scheduled_for data
        const enrichedLeads = await Promise.all(
          (data || []).map(async (lead: any) => {
            // Get latest scheduled_for from lead_responses if status is scheduled
            if (lead.status === 'scheduled') {
              const { data: responseData } = await supabase
                .from('lead_responses')
                .select('scheduled_for')
                .eq('lead_id', lead.id)
                .eq('action', 'later')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

              if (responseData?.scheduled_for) {
                const scheduledDate = new Date(responseData.scheduled_for)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                scheduledDate.setHours(0, 0, 0, 0)
                const daysRemaining = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                
                // If scheduled date has passed, move back to unassigned
                if (daysRemaining <= 0) {
                  await supabase
                    .from('leads')
                    .update({ status: 'unassigned' })
                    .eq('id', lead.id)
                  return { ...lead, status: 'unassigned', daysRemaining: 0 }
                }

                return { ...lead, scheduled_for: responseData.scheduled_for, daysRemaining }
              }
            }
            return lead
          })
        )

        // Sort: scheduled leads by days remaining first, then by creation date
        const sorted = enrichedLeads.sort((a, b) => {
          if (a.status === 'scheduled' && b.status !== 'scheduled') return -1
          if (a.status !== 'scheduled' && b.status === 'scheduled') return 1
          if (a.status === 'scheduled' && b.status === 'scheduled') {
            return (a.daysRemaining || 999) - (b.daysRemaining || 999)
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        setLeads(sorted)
      } catch (error) {
        console.error('[v0] Error fetching leads:', error)
        toast({
          title: 'Error',
          description: 'Failed to load leads',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    if (cityId) {
      fetchLeads()
    }
  }, [cityId, supabase])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      unassigned: 'bg-green-100 text-green-800',
      approved: 'bg-blue-100 text-blue-800',
      declined: 'bg-red-100 text-red-800',
      scheduled: 'bg-yellow-100 text-yellow-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const unassignedLeads = leads.filter(l => l.status === 'unassigned')
  const assignedLeads = leads.filter(l => l.status !== 'unassigned')

  const LeadCard = ({ lead }: { lead: LeadWithSchedule }) => (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/portal/lead/${lead.id}`)}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">
                {lead.data?.name || 'Lead'}
              </h3>
              <Badge variant="outline" className={getStatusColor(lead.status)}>
                {lead.status}
              </Badge>
              {lead.status === 'scheduled' && lead.daysRemaining !== undefined && (
                <p className="text-sm text-foreground font-medium">
                  📅 Days remaining: {lead.daysRemaining}
                </p>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {Object.entries(lead.data || {})
                .filter(([key]) => key !== 'name')
                .slice(0, 2)
                .map(([key, value]) => `${key}: ${value}`)
                .join(' • ')}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="h-10 w-10 p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{cityName}</h1>
            <p className="text-muted-foreground mt-2">Manage your leads</p>
          </div>
        </div>

        <Tabs defaultValue="unassigned" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="unassigned">Unassigned ({unassignedLeads.length})</TabsTrigger>
            <TabsTrigger value="assigned">Assigned ({assignedLeads.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="unassigned" className="space-y-4 mt-6">
            {unassignedLeads.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground">No unassigned leads</p>
                </CardContent>
              </Card>
            ) : (
              unassignedLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
            )}
          </TabsContent>

          <TabsContent value="assigned" className="space-y-4 mt-6">
            {assignedLeads.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground">No assigned leads</p>
                </CardContent>
              </Card>
            ) : (
              assignedLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
