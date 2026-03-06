'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'
import { useSession, clearSessionCache } from '@/lib/session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, LogOut, Users, Filter, RotateCcw, RefreshCw, Database, Download, Upload, Trash2, AlertTriangle, CheckCircle2, Shield } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Progress } from '@/components/ui/progress'

interface ActiveUserDetail {
  user_id: string
  user_name: string
  role: string
  logged_in_at: string
  expires_at: string
}

interface ActivityLog {
  id: string
  user_id: string
  lead_id: string
  action_type: string
  description: string
  created_at: string
  user_name?: string
  user_role?: string
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
  const { session, loading: sessionLoading } = useSession()
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total_leads: 0, total_responses: 0, active_users: 0 })
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [showActiveUsersDialog, setShowActiveUsersDialog] = useState(false)
  const [activeUserDetails, setActiveUserDetails] = useState<ActiveUserDetail[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalLogsCount, setTotalLogsCount] = useState(0)
  const [activeRoleTab, setActiveRoleTab] = useState('all')
  const [selectedUserFilter, setSelectedUserFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  // Backup state
  const [backupLoading, setBackupLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const logsPerPage = 20
  const supabase = getSupabaseClient()

  const fetchData = async () => {
    try {
      if (!session?.user_id) return
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

      // Get active users from sessions table - users who logged in within last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: activeSessionsData } = await supabase
        .from('sessions')
        .select('user_id, user_name, role, created_at, expires_at')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })

      // Deduplicate by user_id - keep latest session per user
      const userSessionMap = new Map<string, any>()
      ;(activeSessionsData || []).forEach((s: any) => {
        if (!userSessionMap.has(s.user_id)) {
          userSessionMap.set(s.user_id, s)
        }
      })

      const activeUsersCount = userSessionMap.size
      const activeUsersList: ActiveUserDetail[] = Array.from(userSessionMap.values()).map((s: any) => ({
        user_id: s.user_id,
        user_name: s.user_name || 'Unknown',
        role: s.role || 'unknown',
        logged_in_at: s.created_at,
        expires_at: s.expires_at,
      }))
      setActiveUserDetails(activeUsersList)

      // Fetch enrichment data with JOINs instead of per-log queries
      const { data: enrichedUsersData } = await supabase
        .from('users')
        .select('id, name, role')
        .in('id', Array.from(new Set((logsData || []).map((l: any) => l.user_id))))

      const { data: enrichedLeadsData } = await supabase
        .from('leads')
        .select('id, data')
        .in('id', Array.from(new Set((logsData || []).map((l: any) => l.lead_id).filter(Boolean))))

      // Create lookup maps
      const userMap = new Map((enrichedUsersData || []).map((u: any) => [u.id, u.name]))
      const userRoleMap = new Map((enrichedUsersData || []).map((u: any) => [u.id, u.role]))
      const leadMap = new Map((enrichedLeadsData || []).map((l: any) => [l.id, l.data?.name]))

      // Enrich logs using maps (no additional queries)
      const enrichedLogs = (logsData || []).map((log: any) => ({
        ...log,
        user_name: userMap.get(log.user_id) || 'Unknown User',
        user_role: userRoleMap.get(log.user_id) || 'unknown',
        lead_name: leadMap.get(log.lead_id) || 'Unknown Lead',
        scheduled_for: null,
      }))

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

  // Check admin authentication on mount
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace('/')
      return
    }
    if (sessionLoading) return
    
    // Check if user role is admin
    if (session && session.user_role !== 'admin') {
      router.replace('/')
      return
    }

    if (session?.user_role === 'admin') {
      fetchData()
    }
  }, [session, sessionLoading, router])

  // Fetch data when page changes (pagination only - no real-time subscriptions)
  useEffect(() => {
    if (session?.user_role === 'admin') {
      fetchData()
    }
  }, [currentPage, session?.user_role])

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      // Auth actions
      login: 'bg-sky-100 text-sky-800',
      logout: 'bg-slate-100 text-slate-800',
      // Lead actions
      approve: 'bg-green-100 text-green-800',
      approved: 'bg-green-100 text-green-800',
      decline: 'bg-red-100 text-red-800',
      declined: 'bg-red-100 text-red-800',
      later: 'bg-yellow-100 text-yellow-800',
      scheduled: 'bg-yellow-100 text-yellow-800',
      lead_approved: 'bg-green-100 text-green-800',
      lead_declined: 'bg-red-100 text-red-800',
      lead_scheduled: 'bg-yellow-100 text-yellow-800',
      // Correction actions
      send_correction: 'bg-orange-100 text-orange-800',
      complete_correction: 'bg-teal-100 text-teal-800',
      // CRUD actions
      create_lead: 'bg-indigo-100 text-indigo-800',
      update_lead: 'bg-blue-100 text-blue-800',
      delete_lead: 'bg-red-100 text-red-800',
      create_user: 'bg-indigo-100 text-indigo-800',
      update_user: 'bg-blue-100 text-blue-800',
      delete_user: 'bg-red-100 text-red-800',
      reset_password: 'bg-amber-100 text-amber-800',
      // Setup actions
      add_niche: 'bg-violet-100 text-violet-800',
      edit_niche: 'bg-violet-100 text-violet-800',
      delete_niche: 'bg-red-100 text-red-800',
      add_city: 'bg-cyan-100 text-cyan-800',
      edit_city: 'bg-cyan-100 text-cyan-800',
      delete_city: 'bg-red-100 text-red-800',
      // Assignment actions
      assign_niche_city: 'bg-purple-100 text-purple-800',
      assign_niche: 'bg-purple-100 text-purple-800',
      unassign_niche: 'bg-purple-100 text-purple-800',
      assign_city: 'bg-fuchsia-100 text-fuchsia-800',
      unassign_city: 'bg-fuchsia-100 text-fuchsia-800',
      // Backup actions
      backup_download: 'bg-blue-100 text-blue-800',
      backup_restore: 'bg-amber-100 text-amber-800',
      delete_all_data: 'bg-red-100 text-red-800',
    }
    return colors[action] || 'bg-gray-100 text-gray-800'
  }

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-700 border-red-200',
      manager: 'bg-purple-100 text-purple-700 border-purple-200',
      caller: 'bg-blue-100 text-blue-700 border-blue-200',
      lead_generator: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    }
    return colors[role] || 'bg-gray-100 text-gray-700 border-gray-200'
  }

  // Filter activities by role tab and user filter
  const getFilteredActivities = () => {
    let filtered = activities
    
    // Filter by role tab
    if (activeRoleTab !== 'all') {
      filtered = filtered.filter(a => a.user_role === activeRoleTab)
    }
    
    // Filter by specific user
    if (selectedUserFilter !== 'all') {
      filtered = filtered.filter(a => a.user_id === selectedUserFilter)
    }
    
    return filtered
  }

  const filteredActivities = getFilteredActivities()

  // Get unique users from activities for the user filter dropdown
  const activityUsers = Array.from(
    new Map(activities.map(a => [a.user_id, { id: a.user_id, name: a.user_name || 'Unknown', role: a.user_role || 'unknown' }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  // Filter users in dropdown based on active role tab
  const filteredUserOptions = activeRoleTab === 'all'
    ? activityUsers
    : activityUsers.filter(u => u.role === activeRoleTab)

  const handleLogout = async () => {
    try {
      // Token is in HttpOnly cookie, automatically sent with request
      await fetch('/api/sessions', {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearSessionCache()
      router.replace('/')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setCurrentPage(0)
    await fetchData()
    setRefreshing(false)
  }

  // Backup handlers
  const handleDownloadBackup = async () => {
    setBackupLoading(true)
    setBackupMessage(null)
    try {
      const res = await fetch('/api/admin/backup', { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create backup')
      }
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lead-management-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setBackupMessage({ type: 'success', text: 'Backup downloaded successfully!' })
    } catch (error: any) {
      setBackupMessage({ type: 'error', text: error.message || 'Failed to download backup' })
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestoreBackup = async (file: File) => {
    setRestoreLoading(true)
    setBackupMessage(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.metadata || !data.tables) {
        throw new Error('Invalid backup file format')
      }
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to restore backup')
      }
      const result = await res.json()
      setBackupMessage({ type: 'success', text: result.message || 'Backup restored successfully!' })
      // Reload page data
      await fetchData()
    } catch (error: any) {
      setBackupMessage({ type: 'error', text: error.message || 'Failed to restore backup' })
    } finally {
      setRestoreLoading(false)
    }
  }

  const handleDeleteAllData = async () => {
    setDeleteLoading(true)
    setBackupMessage(null)
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete data')
      }
      const result = await res.json()
      setBackupMessage({ type: 'success', text: result.message || 'All data deleted successfully!' })
      setDeleteConfirmText('')
      // Reload page data
      await fetchData()
    } catch (error: any) {
      setBackupMessage({ type: 'error', text: error.message || 'Failed to delete data' })
    } finally {
      setDeleteLoading(false)
    }
  }

  if (sessionLoading || !session) {
    return (
      <main className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    )
  }

  if (session.user_role !== 'admin') {
    return (
      <main className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Unauthorized access</p>
        </div>
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
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Reload'}
            </Button>
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
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setShowActiveUsersDialog(true)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Active Users (24h)
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.active_users}</div>
              <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="users">Manage Users</TabsTrigger>
            <TabsTrigger value="backup">Backup & Data</TabsTrigger>
          </TabsList>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Activity Log</CardTitle>
                    <CardDescription>All employee actions across the system</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select
                      value={selectedUserFilter}
                      onValueChange={(val) => setSelectedUserFilter(val)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {filteredUserOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(selectedUserFilter !== 'all' || activeRoleTab !== 'all') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUserFilter('all')
                          setActiveRoleTab('all')
                        }}
                        title="Reset filters"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Role Sub-Tabs */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {[
                    { value: 'all', label: 'All Roles' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'manager', label: 'Manager' },
                    { value: 'caller', label: 'Caller' },
                    { value: 'lead_generator', label: 'Lead Generator' },
                  ].map((tab) => {
                    const count = tab.value === 'all'
                      ? activities.length
                      : activities.filter(a => a.user_role === tab.value).length
                    return (
                      <Button
                        key={tab.value}
                        variant={activeRoleTab === tab.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setActiveRoleTab(tab.value)
                          setSelectedUserFilter('all') // Reset user filter when switching role
                        }}
                        className="text-xs"
                      >
                        {tab.label}
                        <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                          {count}
                        </Badge>
                      </Button>
                    )
                  })}
                </div>
              </CardHeader>
              <CardContent>
                {filteredActivities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {selectedUserFilter !== 'all' || activeRoleTab !== 'all'
                      ? 'No activity found for the selected filter'
                      : 'No activity yet'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {filteredActivities.map((activity: any) => (
                      <div
                        key={activity.id}
                        className="flex items-start justify-between border-b border-border pb-4 last:border-b-0 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                        onClick={() => {
                          setSelectedActivity(activity)
                          setShowDialog(true)
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{activity.user_name}</span>
                            <Badge variant="outline" className={`text-xs ${getRoleBadgeColor(activity.user_role)}`}>
                              {activity.user_role}
                            </Badge>
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
                              Scheduled for: {new Date(activity.scheduled_for).toLocaleDateString()}
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
                        <div className="text-sm text-muted-foreground text-right whitespace-nowrap ml-4">
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
                    Showing {currentPage * logsPerPage + 1} to {Math.min((currentPage + 1) * logsPerPage, totalLogsCount)} of {totalLogsCount} total logs
                    {(activeRoleTab !== 'all' || selectedUserFilter !== 'all') && (
                      <span className="ml-1">({filteredActivities.length} matching filter)</span>
                    )}
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

          {/* Backup & Data Tab */}
          <TabsContent value="backup" className="space-y-6">
            {/* Status Message */}
            {backupMessage && (
              <div className={`flex items-center gap-2 p-4 rounded-lg border ${
                backupMessage.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {backupMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <p className="text-sm font-medium">{backupMessage.text}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setBackupMessage(null)}
                >
                  ✕
                </Button>
              </div>
            )}

            {/* Download Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-600" />
                  Download Backup
                </CardTitle>
                <CardDescription>
                  Export all system data (users, leads, niches, cities, responses, activity logs) as a JSON file.
                  Passwords are stored as hashed values for security.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleDownloadBackup}
                  disabled={backupLoading}
                  className="flex items-center gap-2"
                >
                  {backupLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {backupLoading ? 'Creating Backup...' : 'Download Full Backup'}
                </Button>
              </CardContent>
            </Card>

            {/* Restore Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-600" />
                  Restore Backup
                </CardTitle>
                <CardDescription>
                  Upload a previously downloaded backup file to restore all data.
                  This will <span className="font-semibold text-amber-700">replace all existing data</span> with the backup data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <Input
                    type="file"
                    accept=".json"
                    disabled={restoreLoading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (!confirm('This will REPLACE ALL existing data with the backup contents. Are you sure?')) {
                          e.target.value = ''
                          return
                        }
                        handleRestoreBackup(file)
                        e.target.value = ''
                      }
                    }}
                    className="max-w-md"
                  />
                  {restoreLoading && (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                      <span className="text-sm text-muted-foreground">Restoring data... This may take a moment.</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Delete All Data */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <Trash2 className="w-5 h-5" />
                  Delete All Data
                </CardTitle>
                <CardDescription>
                  Permanently delete all data from the system including leads, responses, niches, cities,
                  activity logs, and sessions. <span className="font-semibold text-red-600">User accounts will be preserved</span> but all other data will be permanently removed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                      <div className="text-sm text-red-800">
                        <p className="font-semibold mb-1">Warning: This action cannot be undone!</p>
                        <p>Please download a backup before proceeding. Type <span className="font-mono font-bold">DELETE ALL DATA</span> below to confirm.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder="Type DELETE ALL DATA to confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="max-w-xs"
                      disabled={deleteLoading}
                    />
                    <Button
                      variant="destructive"
                      disabled={deleteConfirmText !== 'DELETE ALL DATA' || deleteLoading}
                      onClick={handleDeleteAllData}
                      className="flex items-center gap-2"
                    >
                      {deleteLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {deleteLoading ? 'Deleting...' : 'Delete All Data'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Active Users Dialog */}
      <Dialog open={showActiveUsersDialog} onOpenChange={setShowActiveUsersDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Active Users (Last 24 Hours)
            </DialogTitle>
            <DialogDescription>
              Users who logged in within the last 24 hours
            </DialogDescription>
          </DialogHeader>
          {activeUserDetails.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No active users in the last 24 hours</p>
          ) : (
            <ScrollArea className={activeUserDetails.length > 5 ? 'h-[400px]' : ''}>
              <div className="space-y-3">
                {activeUserDetails.map((user, index) => {
                  const isSessionActive = new Date(user.expires_at) > new Date()
                  return (
                    <div
                      key={`${user.user_id}-${index}`}
                      className="flex items-center justify-between border border-border rounded-lg p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{user.user_name}</span>
                          <Badge variant="outline" className="text-xs">{user.role}</Badge>
                          {isSessionActive ? (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-xs text-green-600 font-medium">Online</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-gray-400" />
                              <span className="text-xs text-muted-foreground">Session expired</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Logged in: {new Date(user.logged_in_at).toLocaleDateString()} at{' '}
                          {new Date(user.logged_in_at).toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Session expires: {new Date(user.expires_at).toLocaleDateString()} at{' '}
                          {new Date(user.expires_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
          <Button onClick={() => setShowActiveUsersDialog(false)} className="w-full mt-2">
            Close
          </Button>
        </DialogContent>
      </Dialog>

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
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-foreground font-medium">{selectedActivity.user_name}</p>
                  {selectedActivity.user_role && (
                    <Badge variant="outline" className={`text-xs ${getRoleBadgeColor(selectedActivity.user_role)}`}>
                      {selectedActivity.user_role}
                    </Badge>
                  )}
                </div>
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
