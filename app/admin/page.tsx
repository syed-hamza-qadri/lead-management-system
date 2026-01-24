'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, LogOut } from 'lucide-react'

interface ActivityLog {
  id: string
  user_id: string
  lead_id: string
  action_type: string
  description: string
  created_at: string
  user_name?: string
  lead_name?: string
  scheduled_for?: string | null
}

interface User {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [stats, setStats] = useState({ total_leads: 0, total_responses: 0, active_users: 0 })
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalLogsCount, setTotalLogsCount] = useState(0)
  const logsPerPage = 20
  const supabase = getSupabaseClient()

  // Check admin authentication on mount
  useEffect(() => {
    const validateAdminSession = async () => {
      try {
        // Token is in HttpOnly cookie, automatically sent with request
        const response = await fetch('/api/sessions/validate')

        if (!response.ok) {
          localStorage.removeItem('admin_role')
          router.push('/')
          return
        }

        setIsAuthenticated(true)
      } catch (error) {
        console.error('Session validation error:', error)
        router.push('/')
      }
    }

    validateAdminSession()
  }, [router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch activity logs with pagination
        const { data: logsData, count, error: logsError } = await supabase
          .from('activity_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(currentPage * logsPerPage, (currentPage + 1) * logsPerPage - 1)

        if (logsError) throw logsError
        
        setTotalLogsCount(count || 0)

        // Fetch users
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false })

        if (usersError) throw usersError

        // Fetch stats
        const { count: totalLeads } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })

        const { count: totalResponses } = await supabase
          .from('lead_responses')
          .select('id', { count: 'exact', head: true })

        // Get distinct count of active users in last 24 hours
        const { data: activeUsersData } = await supabase
          .from('activity_log')
          .select('user_id')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        const activeUsersSet = new Set((activeUsersData || []).map((log: any) => log.user_id))
        const activeUsersCount = activeUsersSet.size

        // Enrich activity logs with user and lead names
        const enrichedLogs = await Promise.all(
          (logsData || []).map(async (log: any) => {
            const [userResult, leadResult, responseResult] = await Promise.all([
              supabase.from('users').select('name').eq('id', log.user_id).single(),
              supabase.from('leads').select('data').eq('id', log.lead_id).single(),
              supabase
                .from('lead_responses')
                .select('scheduled_for')
                .eq('lead_id', log.lead_id)
                .eq('employee_id', log.user_id)
                .eq('action', log.action_type)
                .order('created_at', { ascending: false })
                .limit(1)
                .single(),
            ])

            return {
              ...log,
              user_name: userResult.data?.name || 'Unknown User',
              lead_name: leadResult.data?.data?.name || 'Unknown Lead',
              scheduled_for: responseResult.data?.scheduled_for || null,
            }
          })
        )

        setActivities(enrichedLogs)
        setUsers(usersData || [])
        setStats({
          total_leads: totalLeads || 0,
          total_responses: totalResponses || 0,
          active_users: activeUsersCount,
        })
      } catch (error) {
        console.error('[v0] Error fetching admin data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Set up real-time subscription
    const subscription = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, currentPage])

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      approve: 'bg-green-100 text-green-800',
      decline: 'bg-red-100 text-red-800',
      later: 'bg-yellow-100 text-yellow-800',
    }
    return colors[action] || 'bg-gray-100 text-gray-800'
  }

  const handleLogout = async () => {
    try {
      // Token is in HttpOnly cookie, automatically sent with request
      await fetch('/api/sessions/validate', {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('admin_role')
      router.push('/')
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">Monitor system activity and manage users</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                router.push('/admin/setup')
              }}
              className="flex items-center gap-2"
            >
              Setup Data
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_leads}</div>
              <p className="text-xs text-muted-foreground mt-1">In system</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_responses}</div>
              <p className="text-xs text-muted-foreground mt-1">Actions taken</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Users (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.active_users}</div>
              <p className="text-xs text-muted-foreground mt-1">Employees active</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="users">Manage Users</TabsTrigger>
          </TabsList>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Employee actions on leads</CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No activity yet</p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity: any) => (
                      <div
                        key={activity.id}
                        className="flex items-start justify-between border-b border-border pb-4 last:border-b-0 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                        onClick={() => {
                          setSelectedActivity(activity)
                          setShowDialog(true)
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{activity.user_name}</span>
                            <Badge variant="secondary" className={getActionColor(activity.action_type)}>
                              {activity.action_type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Lead: <span className="font-medium">{activity.lead_name}</span>
                          </p>
                          {activity.description && (
                            <p className="text-sm text-foreground mt-1">{activity.description}</p>
                          )}
                          {activity.action_type === 'later' && activity.scheduled_for && (
                            <p className="text-sm text-foreground mt-2 font-medium">
                              📅 Scheduled for: {new Date(activity.scheduled_for).toLocaleDateString()}
                              {(() => {
                                const scheduledDate = new Date(activity.scheduled_for)
                                const today = new Date()
                                today.setHours(0, 0, 0, 0)
                                scheduledDate.setHours(0, 0, 0, 0)
                                const daysRemaining = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                return daysRemaining > 0 ? ` (${daysRemaining} days remaining)` : ' (due today)'
                              })()}
                            </p>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(activity.created_at).toLocaleDateString()} at{' '}
                          {new Date(activity.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              
              {/* Pagination Controls */}
              {totalLogsCount > logsPerPage && (
                <div className="flex items-center justify-between border-t border-border p-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {currentPage * logsPerPage + 1} to {Math.min((currentPage + 1) * logsPerPage, totalLogsCount)} of {totalLogsCount} logs
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                      disabled={currentPage === 0}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Page {currentPage + 1} of {Math.ceil(totalLogsCount / logsPerPage)}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={(currentPage + 1) * logsPerPage >= totalLogsCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Employees</CardTitle>
                  <CardDescription>Manage system users</CardDescription>
                </div>
                <Button onClick={() => router.push('/admin/users')}>
                  Manage Users
                </Button>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No users yet</p>
                ) : (
                  <div className="space-y-4">
                    {users.map((user: any) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between border-b border-border pb-4 last:border-b-0"
                      >
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Badge variant="outline">{user.role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Activity Details Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
            <DialogDescription>Complete information about this activity</DialogDescription>
          </DialogHeader>
          {selectedActivity && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Employee</label>
                <p className="text-foreground font-medium">{selectedActivity.user_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Lead</label>
                <p className="text-foreground font-medium">{selectedActivity.lead_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Action</label>
                <div className="mt-1">
                  <Badge className={getActionColor(selectedActivity.action_type)}>
                    {selectedActivity.action_type}
                  </Badge>
                </div>
              </div>
              {selectedActivity.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <p className="text-foreground mt-1">{selectedActivity.description}</p>
                </div>
              )}
              {selectedActivity.action_type === 'later' && selectedActivity.scheduled_for && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Scheduled For</label>
                  <p className="text-foreground font-medium">
                    {new Date(selectedActivity.scheduled_for).toLocaleDateString()}
                    {(() => {
                      const scheduledDate = new Date(selectedActivity.scheduled_for)
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      scheduledDate.setHours(0, 0, 0, 0)
                      const daysRemaining = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                      return daysRemaining > 0 ? ` (${daysRemaining} days remaining)` : ' (due today)'
                    })()}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Recorded At</label>
                <p className="text-foreground">
                  {new Date(selectedActivity.created_at).toLocaleDateString()} at{' '}
                  {new Date(selectedActivity.created_at).toLocaleTimeString()}
                </p>
              </div>
              <Button onClick={() => setShowDialog(false)} className="w-full mt-4">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
