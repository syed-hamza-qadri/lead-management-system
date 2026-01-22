'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useSession } from '@/lib/session'

interface Lead {
  id: string
  data: Record<string, any>
  status: string
  niche_id: string
  city_id: string
  daysRemaining?: number
  scheduledFor?: string
}

interface PreviousResponse {
  id: string
  action: string
  response_text: string
  scheduled_for: string | null
}

export default function LeadDetail() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const leadId = params.id as string
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [action, setAction] = useState<'approve' | 'decline' | 'later' | null>(null)
  const [response, setResponse] = useState('')
  const [daysToLater, setDaysToLater] = useState('7')
  const [previousResponse, setPreviousResponse] = useState<PreviousResponse | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const supabase = getSupabaseClient()
  const { userId, token, loading: sessionLoading } = useSession()

  useEffect(() => {
    const fetchLead = async () => {
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .single()

        if (error) throw error

        // Get scheduled_for if status is scheduled
        if (data.status === 'scheduled') {
          const { data: responseData } = await supabase
            .from('lead_responses')
            .select('scheduled_for')
            .eq('lead_id', leadId)
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

            data.scheduledFor = responseData.scheduled_for
            data.daysRemaining = daysRemaining
          }
        }

        // Fetch previous response if this lead has been assigned
        const { data: prevResponseData } = await supabase
          .from('lead_responses')
          .select('id, action, response_text, scheduled_for')
          .eq('lead_id', leadId)
          .eq('employee_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (prevResponseData) {
          setPreviousResponse(prevResponseData)
          setAction(prevResponseData.action as 'approve' | 'decline' | 'later')
          setResponse(prevResponseData.response_text || '')
          if (prevResponseData.action === 'later' && prevResponseData.scheduled_for) {
            const scheduledDate = new Date(prevResponseData.scheduled_for)
            const today = new Date()
            const days = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            setDaysToLater(Math.max(1, days).toString())
          }
        }

        setLead(data)
      } catch (error) {
        console.error('[v0] Error fetching lead:', error)
        toast({
          title: 'Error',
          description: 'Failed to load lead details',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    if (leadId) {
      fetchLead()
    }
  }, [leadId, supabase, userId])

  const handleAction = async () => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User session not found. Please login again.',
        variant: 'destructive',
      })
      router.push('/portal')
      return
    }

    console.log('[v0] handleAction - userId:', userId, 'leadId:', leadId, 'action:', action)

    if (!action) {
      toast({
        title: 'Error',
        description: 'Please select an action',
        variant: 'destructive',
      })
      return
    }

    setResponding(true)
    try {
      // Prepare response data
      const responseData = {
        response_text: response,
        action: action,
        scheduled_for: action === 'later' ? new Date(Date.now() + (parseInt(daysToLater) || 7) * 24 * 60 * 60 * 1000).toISOString() : null,
      }

      // Either update existing response or create new one
      if (previousResponse) {
        const { error: updateError } = await supabase
          .from('lead_responses')
          .update(responseData)
          .eq('id', previousResponse.id)

        if (updateError) {
          console.error('Update error:', updateError)
          throw new Error(updateError.message || 'Failed to update response')
        }
      } else {
        const { error: responseError } = await supabase
          .from('lead_responses')
          .insert({
            lead_id: leadId,
            employee_id: userId,
            ...responseData,
          })

        if (responseError) {
          console.error('Response error:', responseError)
          throw new Error(responseError.message || 'Failed to save response')
        }
      }

      // Map action to status value
      const statusMap: Record<string, string> = {
        'approve': 'approved',
        'decline': 'declined',
        'later': 'scheduled',
        'response': 'unassigned',
      }

      // Update lead status
      const { error: updateError } = await supabase
        .from('leads')
        .update({ status: statusMap[action] || action })
        .eq('id', leadId)

      if (updateError) {
        console.error('Update error:', updateError)
        throw new Error(updateError.message || 'Failed to update lead status')
      }

      // Log activity
      const { error: logError } = await supabase
        .from('activity_log')
        .insert({
          user_id: userId,
          lead_id: leadId,
          action_type: action,
          description: `Lead ${action}${response ? ': ' + response : ''}`,
        })

      if (logError) {
        console.error('Log error:', logError)
        // Don't throw - activity log is not critical
      }

      toast({
        title: 'Success',
        description: `Lead ${previousResponse ? 'updated' : 'marked'} as ${action}`,
      })
      router.back()
    } catch (error) {
      console.error('[v0] Error handling action:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to process action'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setResponding(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    )
  }

  if (!lead) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">Lead not found</p>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* Lead Details */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{lead.data?.name || 'Lead Details'}</CardTitle>
                <CardDescription>Lead Information</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline">{lead.status}</Badge>
                {lead.status === 'scheduled' && lead.daysRemaining !== undefined && (
                  <p className="text-sm font-medium text-foreground">
                    📅 {lead.daysRemaining} days remaining
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {lead.data && Object.keys(lead.data).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(lead.data).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <p className="text-foreground mt-1">{String(value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No lead details available</p>
            )}
          </CardContent>
        </Card>

        {/* Response Section */}
        <Card>
          <CardHeader>
            <CardTitle>Respond to Lead</CardTitle>
            <CardDescription>
              {previousResponse ? 'Update your previous response' : 'Record your response and action'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Response Text */}
            <div>
              <label className="text-sm font-medium block mb-2">Notes / Response</label>
              <Textarea
                placeholder="Add any notes or details about your interaction with this lead..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="min-h-24"
              />
            </div>

            {/* Action Selection */}
            <div>
              <label className="text-sm font-medium block mb-3">Select Action</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  variant={action === 'approve' ? 'default' : 'outline'}
                  onClick={() => setAction('approve')}
                  className="h-12"
                >
                  ✓ Approve
                </Button>
                <Button
                  variant={action === 'decline' ? 'default' : 'outline'}
                  onClick={() => setAction('decline')}
                  className="h-12 bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30"
                >
                  ✕ Decline
                </Button>
                <Button
                  variant={action === 'later' ? 'default' : 'outline'}
                  onClick={() => setAction('later')}
                  className="h-12"
                >
                  ⏱ Follow Later
                </Button>
              </div>
            </div>

            {/* Days for Later Action */}
            {action === 'later' && (
              <div>
                <label className="text-sm font-medium block mb-2">
                  Follow up after (days)
                  <span className="text-muted-foreground text-xs ml-2">Default: 7 days</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={daysToLater}
                  onChange={(e) => setDaysToLater(e.target.value)}
                  placeholder="7"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This lead will reappear in {daysToLater} days if you skip this action.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleAction}
                disabled={!action || responding}
                className="flex-1 h-11"
              >
                {responding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : previousResponse ? (
                  'Update Response'
                ) : (
                  'Submit Response'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.back()}
                disabled={responding}
                className="flex-1 h-11"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
