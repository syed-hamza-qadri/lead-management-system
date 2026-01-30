'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ArrowLeft, ChevronRight, Calendar } from 'lucide-react'

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
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const cityId = params.id as string
  const [leads, setLeads] = useState<LeadWithSchedule[]>([])
  const [cityName, setCityName] = useState('')
  const [nicheName, setNicheName] = useState('')
  const [loading, setLoading] = useState(true)
  const [defaultTab, setDefaultTab] = useState('unassigned')
  const supabase = getSupabaseClient()

  // Check for tab query parameter
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'assigned') {
      setDefaultTab('assigned')
    }
  }, [searchParams])

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        // Get city name and niche
        const { data: cityData, error: cityError } = await supabase
          .from('cities')
          .select('name, niche_id, niches(name)')
          .eq('id', cityId)
          .single()

        if (cityError) throw cityError
        setCityName(cityData?.name || '')
        setNicheName(cityData?.niches?.name || '')

      // Get leads for this city
      const { data, error } = await supabase
        .from('leads')
        .select('id, data, status, created_at')
        .eq('city_id', cityId)
        .order('created_at', { ascending: false })
        .limit(100) // Add pagination

      if (error) throw error

      // Fetch all scheduled_for data in one query instead of per-lead
      const leadIds = (data || []).map((l: any) => l.id)
      const { data: responseData } = await supabase
        .from('lead_responses')
        .select('lead_id, scheduled_for, action')
        .in('lead_id', leadIds.length > 0 ? leadIds : [''])
        .eq('action', 'later')
        .order('created_at', { ascending: false })

      // Create lookup map for quick access
      const scheduledMap = new Map<string, string>()
      ;(responseData || []).forEach((response: any) => {
        if (!scheduledMap.has(response.lead_id)) {
          scheduledMap.set(response.lead_id, response.scheduled_for)
        }
      })

      // Enrich leads using map (no additional queries)
      const enrichedLeads = (data || []).map((lead: any) => {
        const scheduledFor = scheduledMap.get(lead.id)
        let daysRemaining = 0

        if (lead.status === 'scheduled' && scheduledFor) {
          const scheduledDate = new Date(scheduledFor)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          scheduledDate.setHours(0, 0, 0, 0)
          daysRemaining = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          // If scheduled date has passed, update status
          if (daysRemaining <= 0) {
            supabase
              .from('leads')
              .update({ status: 'unassigned' })
              .eq('id', lead.id)
              .then()
            return { ...lead, status: 'unassigned', daysRemaining: 0 }
          }
        }

        return { ...lead, scheduled_for: scheduledFor, daysRemaining }
      })

      // Sort: scheduled leads by days remaining first, then by creation date
      const sorted = enrichedLeads.sort((a: any, b: any) => {
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
      unassigned: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      approved: 'bg-blue-100 text-blue-700 border-blue-200',
      declined: 'bg-red-100 text-red-700 border-red-200',
      scheduled: 'bg-amber-100 text-amber-700 border-amber-200',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const unassignedLeads = leads.filter(l => l.status === 'unassigned')
  const assignedLeads = leads.filter(l => l.status !== 'unassigned')

  const LeadCard = ({ lead }: { lead: LeadWithSchedule }) => {
    // Parse and display lead details
    const getDetailFields = () => {
      const fields: Array<[string, string]> = [];
      
      Object.entries(lead.data || {})
        .filter(([key]) => key !== 'name')
        .forEach(([key, value]) => {
          const stringValue = String(value);
          
          // Check if value has key=value pairs
          if (stringValue.includes('=') && stringValue.includes(',')) {
            stringValue.split(',').forEach(pair => {
              const [k, v] = pair.split('=').map(s => s.trim());
              if (k) fields.push([k, v || '']);
            });
          } else if (stringValue.includes('=') && !stringValue.includes(',')) {
            const [k, v] = stringValue.split('=').map(s => s.trim());
            if (k) fields.push([k, v || '']);
          } else {
            fields.push([key.replace(/_/g, ' '), stringValue]);
          }
        });
      
      return fields;
    };

    const detailFields = getDetailFields().slice(0, 3); // Show first 3 fields

    return (
      <Card
        className="hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer border overflow-hidden"
        onClick={() => router.push(`/portal/lead/${lead.id}`)}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header with Status */}
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/50">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-1">
                  {lead.data?.name || 'Lead'}
                </h3>
                {lead.status === 'scheduled' && lead.daysRemaining !== undefined && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {lead.daysRemaining}d
                  </p>
                )}
              </div>
              <Badge 
                variant="outline" 
                className={`text-xs px-2 py-1 font-semibold whitespace-nowrap border ${getStatusColor(lead.status)}`}
              >
                {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
              </Badge>
            </div>

            {/* Details Grid with Icons */}
            {detailFields.length > 0 && (
              <div className="space-y-2">
                {detailFields.map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <p className="text-xs font-semibold text-muted-foreground capitalize">
                      {key}
                    </p>
                    <p className="text-foreground truncate text-xs leading-snug">
                      {value}
                    </p>
                  </div>
                ))}
                {detailFields.length > 0 && Object.keys(lead.data || {}).length > 4 && (
                  <div className="text-xs text-primary pt-1 flex items-center gap-1 font-semibold">
                    <ChevronRight className="w-3 h-3" />
                    View all details
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
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
            <h1 className="text-3xl font-bold text-foreground">
              {nicheName} in {cityName}
            </h1>
            <p className="text-muted-foreground mt-2">Manage your leads</p>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="unassigned">Unassigned ({unassignedLeads.length})</TabsTrigger>
            <TabsTrigger value="assigned">Assigned ({assignedLeads.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="unassigned" className="space-y-3 mt-6">
            {unassignedLeads.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground">No unassigned leads</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassignedLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="assigned" className="space-y-3 mt-6">
            {assignedLeads.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground">No assigned leads</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {assignedLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
