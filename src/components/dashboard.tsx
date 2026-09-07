import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bike,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Dumbbell,
  ExternalLink,
  Footprints,
  Heart,
  HeartPulse,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricRing, SleepChart, TrendChart } from './performance-charts'
import {
  buildDailyStats,
  duration,
  localDate,
  mean,
  recoveryColor,
  type DailyStats,
  type DashboardData,
  type WhoopRecord,
} from '@/lib/whoop'
import { demoDashboard } from '@/lib/demo'
import { cn } from '@/lib/utils'

type Section = 'overview' | 'recovery' | 'sleep' | 'activity'
const sections: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'recovery', label: 'Recovery', icon: HeartPulse },
  { id: 'sleep', label: 'Sleep', icon: Moon },
  { id: 'activity', label: 'Activities', icon: Activity },
]
const authErrors: Record<string, string> = {
  invalid_state: 'Your connection request expired. Please connect again.',
  access_denied:
    'WHOOP access wasn’t granted. You can try connecting again when you’re ready.',
  account_not_allowed:
    'Please sign in with the WHOOP account configured for this personal dashboard.',
  missing_refresh_token:
    'WHOOP did not return a refresh token. Check that the offline scope is enabled in your app’s OAuth configuration.',
  connection_failed:
    'We couldn’t finish connecting. Check that the database migration has been applied, then try again.',
  reconnect_required:
    'Your WHOOP connection needs to be renewed. Please connect again.',
}

async function fetchDashboard(): Promise<DashboardData | null> {
  const response = await fetch('/api/dashboard')
  if (response.status === 401) return null
  if (!response.ok)
    throw new Error(
      'Your dashboard couldn’t be loaded. Check the connection and try again.',
    )
  return response.json()
}

const format = (value: number | null | undefined, decimals = 0) =>
  value == null ? '—' : value.toFixed(decimals)
const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) => new Date(`${date}T12:00:00`).toLocaleDateString('en', options)

export function Dashboard() {
  const [section, setSection] = useState<Section>('overview')
  const [range, setRange] = useState(30)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [showAllWorkouts, setShowAllWorkouts] = useState(false)
  const demo = useMemo(demoDashboard, [])
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    retry: false,
    staleTime: 60_000,
    refetchInterval: (q) => (q.state.data?.syncing ? 3000 : 60_000),
    refetchOnWindowFocus: true,
  })
  const data = preview ? demo : query.data
  const lastAutoSyncAttempt = useRef(0)
  const sync = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sync', { method: 'POST' })
      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(
          error === 'reconnect_required'
            ? 'Please reconnect your WHOOP account.'
            : error === 'rate_limited'
              ? 'WHOOP’s rate limit was reached. Please try again in a few minutes.'
              : 'Sync didn’t finish. Your previously synced data is still available.',
        )
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const logout = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Could not sign out. Try again.')
    },
    onSuccess: () => {
      queryClient.setQueryData(['dashboard'], null)
      setPreview(false)
      lastAutoSyncAttempt.current = 0
    },
  })

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('auth_error')
    if (error) {
      setAuthError(
        authErrors[error] ?? 'WHOOP could not be connected. Please try again.',
      )
      window.history.replaceState({}, '', '/')
    }
  }, [])
  useEffect(() => {
    if (
      !preview &&
      data &&
      !data.syncing &&
      !data.needsReconnect &&
      !sync.isPending &&
      Date.now() - lastAutoSyncAttempt.current > 15 * 60_000
    ) {
      if (
        !data.syncedAt ||
        Date.now() - new Date(data.syncedAt).getTime() > 15 * 60_000
      ) {
        lastAutoSyncAttempt.current = Date.now()
        sync.mutate()
      }
    }
  }, [data, preview])

  const allDays = useMemo(() => buildDailyStats(data?.records ?? []), [data])
  const cutoff = localDate(
    new Date(Date.now() - (range - 1) * 86_400_000).toISOString(),
    allDays.at(-1)?.timezoneOffset,
  )
  const days = allDays.filter((day) => day.date >= cutoff)
  const latest = allDays.at(-1)
  const current = allDays.find((day) => day.cycleId === selectedDate) ?? latest
  const currentIndex = current
    ? allDays.findIndex((day) => day.cycleId === current.cycleId)
    : -1
  const syncing = sync.isPending || !!data?.syncing
  const workouts = (data?.records ?? [])
    .filter(
      (r) =>
        r.kind === 'workout' &&
        r.data.start &&
        localDate(r.data.start, r.data.timezone_offset) >= cutoff,
    )
    .map((r) => r.data)
    .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="FORM home">
          <Waves size={28} strokeWidth={2.7} />
          <span>
            FORM<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">YOUR DAILY EDGE</div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              className={cn('nav-item', section === id && 'active')}
              onClick={() => {
                setSection(id)
                setShowAllWorkouts(false)
              }}
              aria-current={section === id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {section === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className="connection-symbol">
              <Activity size={17} />
            </span>
            <div>
              <strong>Powered by WHOOP</strong>
              <span>
                {preview
                  ? 'Preview mode'
                  : data
                    ? 'Account connected'
                    : 'Connect your account'}
              </span>
            </div>
            <span className={cn('status-dot', data && !preview && 'online')} />
          </div>
          <a
            href="https://support.whoop.com"
            target="_blank"
            rel="noreferrer"
            className="help-link"
          >
            <CircleHelp size={16} /> Help & resources <ExternalLink size={13} />
          </a>
          <div className="profile">
            <div className="avatar">
              {data ? data.user.firstName[0] : <Activity size={19} />}
            </div>
            <div>
              <strong>
                {data
                  ? `${data.user.firstName} ${data.user.lastName}`
                  : 'Your personal space'}
              </strong>
              <span>
                {preview
                  ? 'Demo profile'
                  : data
                    ? 'Personal dashboard'
                    : 'Built around you'}
              </span>
            </div>
            {data && !preview && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Account menu">
                    <ChevronDown size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{data.user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/api/auth/whoop">
                      <RefreshCw /> Reconnect WHOOP
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    <LogOut /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>{sections.find((s) => s.id === section)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <ShieldCheck size={14} /> Private workspace
            </span>
            {preview ? (
              <Badge variant="outline" className="demo-badge">
                DEMO DATA
              </Badge>
            ) : (
              <span className="live-status">
                <span className={cn('status-dot', data && 'online')} />
                {data ? 'WHOOP connected' : 'Not connected'}
              </span>
            )}
            {data && !preview && (
              <div className="mobile-account">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Account menu"
                    >
                      <ChevronDown size={15} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{data.user.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/api/auth/whoop">
                        <RefreshCw /> Reconnect WHOOP
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => logout.mutate()}
                      disabled={logout.isPending}
                    >
                      <LogOut /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </header>
        <main className="main-content">
          {preview && (
            <div className="preview-banner">
              <span>
                <Sparkles size={15} /> You’re exploring a demo. Connect WHOOP to
                see your own stats.
              </span>
              <button onClick={() => setPreview(false)} aria-label="Exit demo">
                <X size={17} />
              </button>
            </div>
          )}
          {(authError || query.error || logout.error) && (
            <div role="alert" className="error-banner">
              <span>
                {authError || query.error?.message || logout.error?.message}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAuthError(null)
                  void query.refetch()
                  logout.reset()
                }}
              >
                Try again
              </Button>
            </div>
          )}
          {query.isPending && !preview ? (
            <LoadingDashboard />
          ) : !data ? (
            <Welcome onPreview={() => setPreview(true)} />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">A LITTLE MORE IN TUNE WITH YOU</p>
                  <h1>
                    {section === 'overview'
                      ? `Your daily overview${preview ? '' : `, ${data.user.firstName}`}`
                      : section === 'recovery'
                        ? 'Ready for what’s next.'
                        : section === 'sleep'
                          ? 'Better days start at night.'
                          : 'Make every move count.'}
                  </h1>
                  <p className="page-subtitle">
                    {section === 'overview'
                      ? 'Your recovery, rest, and effort. All in one place.'
                      : section === 'recovery'
                        ? 'A closer look at your recovery and the signals behind it.'
                        : section === 'sleep'
                          ? 'Understand your sleep, from consistency to the restorative stages.'
                          : 'A record of your effort, one session at a time.'}
                  </p>
                </div>
                <div className="heading-actions">
                  {preview ? (
                    <Button asChild className="connect-button">
                      <a href="/api/auth/whoop">
                        Connect WHOOP <ArrowRight size={15} />
                      </a>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => sync.mutate()}
                      disabled={syncing || data.needsReconnect}
                    >
                      <RefreshCw
                        className={syncing ? 'animate-spin' : ''}
                        size={14}
                      />
                      {syncing ? 'Syncing…' : 'Sync now'}
                    </Button>
                  )}
                </div>
              </div>
              {(sync.error || data.syncError) && (
                <div className="error-banner" role="alert">
                  <span>
                    {sync.error?.message ??
                      (data.needsReconnect
                        ? 'Please renew your WHOOP connection to keep syncing.'
                        : 'Your last sync didn’t finish. Previously synced data is still available.')}
                  </span>
                  {data.needsReconnect && (
                    <Button asChild size="sm">
                      <a href="/api/auth/whoop">Reconnect WHOOP</a>
                    </Button>
                  )}
                </div>
              )}
              {!latest && (
                <div className="sync-banner">
                  <LoaderCircle
                    size={17}
                    className={syncing ? 'animate-spin' : ''}
                  />
                  <span>
                    {syncing
                      ? 'Bringing in your last 90 days. This first sync can take a minute.'
                      : 'No data synced yet. Use Sync now to bring in your WHOOP stats.'}
                  </span>
                </div>
              )}
              <div className="date-toolbar">
                <div className="date-selector">
                  <CalendarDays size={15} />
                  <select
                    aria-label="Select physiological day"
                    value={current?.cycleId ?? ''}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    disabled={!allDays.length}
                  >
                    {!allDays.length && (
                      <option value="">No recorded days</option>
                    )}
                    {[...allDays].reverse().map((day) => (
                      <option key={day.cycleId} value={day.cycleId}>
                        {dateLabel(day.date, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </option>
                    ))}
                  </select>
                  <div className="date-arrows">
                    <button
                      aria-label="Previous day"
                      disabled={currentIndex <= 0}
                      onClick={() =>
                        setSelectedDate(allDays[currentIndex - 1].cycleId)
                      }
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      aria-label="Next day"
                      disabled={
                        currentIndex < 0 || currentIndex >= allDays.length - 1
                      }
                      onClick={() =>
                        setSelectedDate(allDays[currentIndex + 1].cycleId)
                      }
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
                <span className="updated-label">
                  {preview
                    ? 'Sample data · for exploration'
                    : syncing
                      ? 'Updating your stats…'
                      : data.syncedAt
                        ? `Last synced ${new Date(data.syncedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Waiting for first sync'}
                </span>
              </div>
              <div className="metrics-grid">
                <MetricCard
                  title="RECOVERY"
                  value={format(current?.recovery)}
                  unit="%"
                  icon={HeartPulse}
                  color={recoveryColor(current?.recovery ?? null)}
                  ringValue={current?.recovery ?? null}
                  ringMax={100}
                  note={
                    current?.recovery == null
                      ? 'Awaiting a scored recovery'
                      : current.recovery >= 67
                        ? 'High recovery'
                        : current.recovery >= 34
                          ? 'Moderate recovery'
                          : 'Low recovery'
                  }
                  detail="WHOOP recovery score"
                  active={section === 'recovery'}
                  onClick={() => setSection('recovery')}
                />
                <MetricCard
                  title="DAY STRAIN"
                  value={format(current?.strain, 1)}
                  unit="/ 21"
                  icon={Zap}
                  color="#eeb57d"
                  ringValue={current?.strain ?? null}
                  ringMax={21}
                  note={
                    current?.calories == null
                      ? 'Awaiting a scored cycle'
                      : `${Math.round(current.calories).toLocaleString()} kcal expended`
                  }
                  detail="Total effort this cycle"
                  active={section === 'activity'}
                  onClick={() => setSection('activity')}
                />
                <MetricCard
                  title="SLEEP PERFORMANCE"
                  value={format(current?.sleepPerformance)}
                  unit="%"
                  icon={Moon}
                  color="#b7a3de"
                  ringValue={current?.sleepPerformance ?? null}
                  ringMax={100}
                  note={
                    current?.sleepHours == null
                      ? 'Awaiting a scored sleep'
                      : `${duration(current.sleepHours)} of sleep`
                  }
                  detail={
                    current?.sleepNeededHours == null
                      ? 'Time asleep vs. sleep needed'
                      : `${duration(current.sleepNeededHours)} needed`
                  }
                  active={section === 'sleep'}
                  onClick={() => setSection('sleep')}
                />
              </div>
              <div className="section-toolbar">
                <div>
                  <h2>
                    Your{' '}
                    {section === 'overview'
                      ? 'performance'
                      : section === 'activity'
                        ? 'activity'
                        : section}{' '}
                    trends
                  </h2>
                  <p>A wider view of how you’re doing.</p>
                </div>
                <Tabs
                  value={String(range)}
                  onValueChange={(value) => setRange(Number(value))}
                >
                  <TabsList aria-label="Trend date range">
                    {[7, 30, 90].map((n) => (
                      <TabsTrigger key={n} value={String(n)}>
                        {n} days
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="trends-grid">
                <section className="panel primary-trend">
                  <PanelHeading
                    title={
                      section === 'sleep'
                        ? 'Time asleep'
                        : section === 'activity'
                          ? 'Daily strain'
                          : 'Recovery trend'
                    }
                    description={`Last ${range} days`}
                    tip={
                      section === 'activity'
                        ? 'WHOOP strain uses a nonlinear 0–21 scale. Daily strain is not the sum of workout strain.'
                        : 'Only scored records are shown. Missing values are never treated as zero.'
                    }
                  />
                  <div className="chart-stat">
                    <strong>
                      {section === 'sleep'
                        ? duration(mean(days.map((d) => d.sleepHours)))
                        : format(
                            mean(
                              days.map((d) =>
                                section === 'activity' ? d.strain : d.recovery,
                              ),
                            ),
                            section === 'activity' ? 1 : 0,
                          )}
                    </strong>
                    <span>
                      {section === 'sleep'
                        ? 'average sleep'
                        : section === 'activity'
                          ? '/ 21 average strain'
                          : '% average recovery'}
                    </span>
                    <span className="chart-legend">
                      <i
                        style={{
                          background:
                            section === 'sleep'
                              ? '#b7a3de'
                              : section === 'activity'
                                ? '#eeb57d'
                                : '#d4ed85',
                        }}
                      />
                      {section === 'sleep'
                        ? 'Time asleep'
                        : section === 'activity'
                          ? 'Day strain'
                          : 'Recovery'}
                    </span>
                  </div>
                  <TrendChart
                    days={days}
                    metric={
                      section === 'sleep'
                        ? 'sleepHours'
                        : section === 'activity'
                          ? 'strain'
                          : 'recovery'
                    }
                    label={
                      section === 'sleep'
                        ? 'Sleep'
                        : section === 'activity'
                          ? 'Strain'
                          : 'Recovery'
                    }
                    unit={section === 'activity' ? ' / 21' : '%'}
                    color={
                      section === 'sleep'
                        ? '#b7a3de'
                        : section === 'activity'
                          ? '#eeb57d'
                          : '#d4ed85'
                    }
                  />
                  <div className="panel-footnote">
                    {days.length} physiological days recorded{' '}
                    <span>Daily values · WHOOP</span>
                  </div>
                </section>
                <section className="panel health-panel">
                  <PanelHeading
                    title={
                      section === 'sleep' ? 'Sleep quality' : 'Your key signals'
                    }
                    description={
                      current
                        ? dateLabel(current.date, {
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'Your selected day'
                    }
                    tip="Compare these readings with your own recent baseline. They are measurements, not diagnoses."
                  />
                  <div className="signals">
                    {section === 'sleep' ? (
                      <>
                        <Signal
                          label="Sleep efficiency"
                          value={current?.sleepEfficiency}
                          unit="%"
                          icon={Moon}
                          baseline={mean(days.map((d) => d.sleepEfficiency))}
                        />
                        <Signal
                          label="Sleep consistency"
                          value={current?.sleepConsistency}
                          unit="%"
                          icon={CalendarDays}
                          baseline={mean(days.map((d) => d.sleepConsistency))}
                        />
                        <Signal
                          label="Respiratory rate"
                          value={current?.respiratoryRate}
                          unit="rpm"
                          icon={Waves}
                          baseline={mean(days.map((d) => d.respiratoryRate))}
                          decimals={1}
                        />
                      </>
                    ) : (
                      <>
                        <Signal
                          label="Heart rate variability"
                          value={current?.hrv}
                          unit="ms"
                          icon={HeartPulse}
                          baseline={mean(days.map((d) => d.hrv))}
                        />
                        <Signal
                          label="Resting heart rate"
                          value={current?.rhr}
                          unit="bpm"
                          icon={Heart}
                          baseline={mean(days.map((d) => d.rhr))}
                        />
                        <Signal
                          label="Respiratory rate"
                          value={current?.respiratoryRate}
                          unit="rpm"
                          icon={Waves}
                          baseline={mean(days.map((d) => d.respiratoryRate))}
                          decimals={1}
                        />
                      </>
                    )}
                  </div>
                  <div className="baseline-note">
                    <span className="status-dot online" />
                    Compared with your {range}-day average
                  </div>
                </section>
              </div>
              {section === 'recovery' ? (
                <div className="secondary-grid">
                  <section className="panel">
                    <PanelHeading
                      title="Heart rate variability"
                      description="The rhythm behind your recovery"
                    />
                    <TrendChart
                      days={days}
                      metric="hrv"
                      label="HRV"
                      unit=" ms"
                      color="#92cddd"
                    />
                  </section>
                  <section className="panel">
                    <PanelHeading
                      title="Resting heart rate"
                      description="Your heart at rest"
                    />
                    <TrendChart
                      days={days}
                      metric="rhr"
                      label="Resting HR"
                      unit=" bpm"
                      color="#e19789"
                    />
                  </section>
                </div>
              ) : (
                <div className="secondary-grid">
                  <section className="panel">
                    <PanelHeading
                      title="Sleep breakdown"
                      description={`${duration(mean(days.map((d) => d.sleepHours)))} average per night`}
                    />
                    <div className="stage-legend">
                      <Legend color="#766795" label="Deep" />
                      <Legend color="#b7a3de" label="REM" />
                      <Legend color="#ddd3ed" label="Light" />
                    </div>
                    <SleepChart days={days} />
                    <div className="panel-footnote">
                      Sleep-stage totals <span>Naps excluded</span>
                    </div>
                  </section>
                  <section className="panel workout-panel">
                    <PanelHeading
                      title="Recent activities"
                      description={`${workouts.length} sessions in the last ${range} days`}
                      action={
                        workouts.length > 3 ? (
                          <button
                            className="text-action"
                            onClick={() => {
                              setShowAllWorkouts(!showAllWorkouts)
                              setSection('activity')
                            }}
                          >
                            {showAllWorkouts ? 'Show less' : 'View all'}{' '}
                            <ArrowRight size={13} />
                          </button>
                        ) : undefined
                      }
                    />
                    <div className="workout-list">
                      {workouts.length ? (
                        workouts
                          .slice(0, showAllWorkouts ? undefined : 3)
                          .map((workout) => (
                            <WorkoutRow
                              key={String(workout.id)}
                              workout={workout}
                            />
                          ))
                      ) : (
                        <p className="empty-message">
                          Your recorded workouts will appear here.
                        </p>
                      )}
                    </div>
                    <div className="workout-summary">
                      <span>
                        <Zap size={14} /> Average session strain
                      </span>
                      <strong>
                        {format(
                          mean(
                            workouts
                              .filter((w) => w.score_state === 'SCORED')
                              .map((w) => w.score?.strain),
                          ),
                          1,
                        )}
                      </strong>
                    </div>
                  </section>
                </div>
              )}
              <div className="bottom-signals">
                <div>
                  <span>Blood oxygen</span>
                  <strong>
                    {format(current?.spo2, 1)} <small>%</small>
                  </strong>
                </div>
                <div>
                  <span>Skin temperature</span>
                  <strong>
                    {format(current?.skinTemp, 1)} <small>°C</small>
                  </strong>
                </div>
                <div>
                  <span>Restorative sleep</span>
                  <strong>
                    {current?.deepHours != null && current?.remHours != null
                      ? duration(current.deepHours + current.remHours)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Days in view</span>
                  <strong>
                    {days.length} <small>/ {range}</small>
                  </strong>
                </div>
              </div>
              <DailyTable days={days} />
              <footer className="page-footer">
                <span>
                  <ShieldCheck size={13} /> Your data. Your perspective.
                </span>
                <span>
                  {preview
                    ? 'Illustrative demo · not real health data'
                    : 'Data from WHOOP · Dates follow your physiological cycles'}
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function Welcome({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome-copy">
        <Badge variant="outline" className="welcome-badge">
          <span className="status-dot online" /> YOUR PERSONAL PERFORMANCE SPACE
        </Badge>
        <h1>
          Know your body.
          <br />
          <span>Find your form.</span>
        </h1>
        <p>
          Turn your WHOOP data into a clearer picture of you. Your sleep,
          recovery, and effort — connected in one thoughtful dashboard.
        </p>
        <div className="welcome-actions">
          <Button asChild size="lg" className="connect-button">
            <a href="/api/auth/whoop">
              Connect your WHOOP <ArrowRight size={18} />
            </a>
          </Button>
          <button className="preview-link" onClick={onPreview}>
            Explore a demo <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="welcome-trust">
          <ShieldCheck size={16} />
          <span>
            Private to you. Read-only access. Connect securely with WHOOP.
          </span>
        </div>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <div className="orbital orbital-one" />
        <div className="orbital orbital-two" />
        <div className="orbital orbital-three" />
        <div className="orbit-center">
          <Waves size={58} strokeWidth={1.3} />
          <span>IN YOUR ELEMENT</span>
        </div>
        <div className="orbit-label label-recovery">
          <HeartPulse size={17} />
          <span>Recover</span>
          <i />
        </div>
        <div className="orbit-label label-sleep">
          <Moon size={17} />
          <span>Rest</span>
          <i />
        </div>
        <div className="orbit-label label-strain">
          <Zap size={17} />
          <span>Perform</span>
          <i />
        </div>
      </div>
      <div className="welcome-features">
        {[
          {
            icon: HeartPulse,
            title: 'Read your readiness',
            text: 'Recovery, HRV, and resting heart rate in context.',
            color: '#d4ed85',
          },
          {
            icon: Moon,
            title: 'Understand your rest',
            text: 'Sleep stages, performance, and consistency over time.',
            color: '#b7a3de',
          },
          {
            icon: Zap,
            title: 'See your effort',
            text: 'Daily strain and workouts, with room to spot your patterns.',
            color: '#eeb57d',
          },
        ].map(({ icon: Icon, title, text, color }) => (
          <div key={title}>
            <Icon size={23} style={{ color }} />
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  color,
  ringValue,
  ringMax,
  note,
  detail,
  active,
  onClick,
}: {
  title: string
  value: string
  unit: string
  icon: LucideIcon
  color: string
  ringValue: number | null
  ringMax: number
  note: string
  detail: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={cn('metric-card', active && 'selected')}
      onClick={onClick}
    >
      <div className="metric-title">
        <span>{title}</span>
        <ArrowUpRight size={15} />
      </div>
      <div className="metric-main">
        <div className="metric-value">
          {value}
          <span>{unit}</span>
        </div>
        <MetricRing value={ringValue} max={ringMax} color={color} icon={Icon} />
      </div>
      <div className="metric-note">
        <span style={{ color }}>
          <i style={{ background: color }} />
          {note}
        </span>
        <small>{detail}</small>
      </div>
    </button>
  )
}

function PanelHeading({
  title,
  description,
  tip,
  action,
}: {
  title: string
  description?: string
  tip?: string
  action?: ReactNode
}) {
  return (
    <div className="panel-heading">
      <div>
        <div className="panel-title">
          <h3>{title}</h3>
          {tip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label={`About ${title}`}>
                  <CircleHelp size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{tip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

function Signal({
  label,
  value,
  unit,
  icon: Icon,
  baseline,
  decimals = 0,
}: {
  label: string
  value: number | null | undefined
  unit: string
  icon: LucideIcon
  baseline: number | null
  decimals?: number
}) {
  const difference = value != null && baseline != null ? value - baseline : null
  return (
    <div className="signal">
      <div className="signal-name">
        <Icon size={17} />
        <span>{label}</span>
      </div>
      <div className="signal-reading">
        <strong>
          {format(value, decimals)} <small>{unit}</small>
        </strong>
        <span className="signal-change">
          {difference == null ? (
            'No baseline yet'
          ) : Math.abs(difference) < 0.5 ? (
            <>
              <Check size={13} /> At your average
            </>
          ) : (
            <>
              {difference > 0 ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownRight size={14} />
              )}
              {Math.abs(difference).toFixed(decimals)} {unit}{' '}
              {difference > 0 ? 'above' : 'below'} avg.
            </>
          )}
        </span>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span>
      <i style={{ background: color }} />
      {label}
    </span>
  )
}

function WorkoutRow({ workout }: { workout: WhoopRecord }) {
  const sport = (workout.sport_name ?? 'Workout').replaceAll('_', ' ')
  const Icon = /cycl|bike/i.test(sport)
    ? Bike
    : /run|walk|hik/i.test(sport)
      ? Footprints
      : Dumbbell
  const score = workout.score_state === 'SCORED' ? workout.score : null
  const workoutHours =
    workout.start && workout.end
      ? (new Date(workout.end).getTime() - new Date(workout.start).getTime()) /
        3_600_000
      : null
  return (
    <details className="workout-row">
      <summary>
        <span className="workout-icon">
          <Icon size={20} />
        </span>
        <span className="workout-info">
          <strong>{sport}</strong>
          <span>
            {workout.start
              ? dateLabel(localDate(workout.start, workout.timezone_offset))
              : ''}{' '}
            <i />
            {duration(workoutHours)}
          </span>
        </span>
        <span className="workout-strain">
          {format(score?.strain, 1)}
          <small>STRAIN</small>
        </span>
        <ChevronDown size={14} />
      </summary>
      <div className="workout-detail">
        <span>
          Average HR <strong>{format(score?.average_heart_rate)} bpm</strong>
        </span>
        <span>
          Max HR <strong>{format(score?.max_heart_rate)} bpm</strong>
        </span>
        <span>
          Energy{' '}
          <strong>
            {score?.kilojoule == null
              ? '—'
              : Math.round(score.kilojoule / 4.184)}{' '}
            kcal
          </strong>
        </span>
        {score?.distance_meter != null && (
          <span>
            Distance{' '}
            <strong>{(score.distance_meter / 1000).toFixed(2)} km</strong>
          </span>
        )}
      </div>
    </details>
  )
}

function DailyTable({ days }: { days: DailyStats[] }) {
  return (
    <details className="daily-table">
      <summary>
        Explore daily data <ChevronDown size={15} />
      </summary>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            Daily WHOOP metrics for the selected range. A dash means a score is
            not available.
          </caption>
          <thead>
            <tr>
              {[
                'Date',
                'Recovery',
                'Strain',
                'Sleep',
                'Deep',
                'REM',
                'Light',
                'HRV',
                'Resting HR',
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((day) => (
              <tr key={day.cycleId}>
                <th scope="row">{dateLabel(day.date)}</th>
                <td style={{ color: recoveryColor(day.recovery) }}>
                  {format(day.recovery)}
                  {day.recovery == null ? '' : '%'}
                </td>
                <td>{format(day.strain, 1)}</td>
                <td>{duration(day.sleepHours)}</td>
                <td>{duration(day.deepHours)}</td>
                <td>{duration(day.remHours)}</td>
                <td>{duration(day.lightHours)}</td>
                <td>{format(day.hrv)} ms</td>
                <td>{format(day.rhr)} bpm</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!days.length && (
          <p className="empty-message">No recorded days in this range.</p>
        )}
      </div>
    </details>
  )
}

function LoadingDashboard() {
  return (
    <div
      className="loading-dashboard"
      role="status"
      aria-label="Loading dashboard"
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-5 h-10 w-80 max-w-full" />
      <div className="metrics-grid mt-12">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80 rounded-2xl" />
    </div>
  )
}
