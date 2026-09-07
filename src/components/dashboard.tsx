import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  Bike,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Dumbbell,
  Footprints,
  HeartPulse,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Moon,
  MoveDownRight,
  MoveUpRight,
  RefreshCw,
  ShieldCheck,
  ScanHeart,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import {
  MetricRing,
  SleepChart,
  SleepStagesBar,
  TrendChart,
  trendMetrics,
  type TrendMetric,
} from './performance-charts'
import {
  buildDailyStats,
  duration,
  daysThrough,
  shiftDate,
  localDate,
  localTime,
  mean,
  type DailyStats,
  type DashboardData,
  type WhoopRecord,
} from '@/lib/whoop'
import { palette, recoveryTone } from '@/lib/palette'
import { demoDashboard } from '@/lib/demo'
import { DayPicker } from './day-picker'
import { HealthMonitor } from './health-monitor'
import { SleepDetails } from './sleep-details'
import { DailyHeartRate, WorkoutDetails } from './workout-details'
import { cn } from '@/lib/utils'

type Section = 'overview' | 'recovery' | 'sleep' | 'activity' | 'health'
const sections: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'health', label: 'Health', icon: ScanHeart },
  { id: 'recovery', label: 'Recovery', icon: HeartPulse },
  { id: 'sleep', label: 'Sleep', icon: Moon },
  { id: 'activity', label: 'Activity', icon: Activity },
]
const primaryMetric: Record<Section, TrendMetric> = {
  overview: 'recovery',
  recovery: 'recovery',
  sleep: 'sleepHours',
  activity: 'strain',
  health: 'hrv',
}
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
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })

export function Dashboard() {
  const [section, setSection] = useState<Section>('overview')
  const [range, setRange] = useState(30)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
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
  const latest = allDays.at(-1)
  const current = allDays.find((day) => day.cycleId === selectedDate) ?? latest
  const periodEnd = current?.date ?? localDate(new Date().toISOString())
  const cutoff = shiftDate(periodEnd, 1 - range)
  const days = daysThrough(allDays, periodEnd, range)
  const currentIndex = current
    ? allDays.findIndex((day) => day.cycleId === current.cycleId)
    : -1
  const canStep = (delta: -1 | 1) =>
    currentIndex >= 0 &&
    currentIndex + delta >= 0 &&
    currentIndex + delta < allDays.length
  const step = (delta: -1 | 1) => {
    if (canStep(delta)) setSelectedDate(allDays[currentIndex + delta].cycleId)
  }
  const syncing = sync.isPending || !!data?.syncing
  const workouts = (data?.records ?? [])
    .filter(
      (r) =>
        r.kind === 'workout' &&
        r.data.start &&
        localDate(r.data.start, r.data.timezone_offset) >= cutoff &&
        localDate(r.data.start, r.data.timezone_offset) <= periodEnd,
    )
    .map((r) => r.data)
    .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
  const todaysWorkouts = current
    ? workouts.filter(
        (w) => localDate(w.start!, w.timezone_offset) === current.date,
      )
    : []
  const todayDate = localDate(new Date().toISOString(), current?.timezoneOffset)
  const relativeDay =
    current?.date === todayDate
      ? 'Today'
      : current?.date ===
          localDate(
            new Date(Date.now() - 86_400_000).toISOString(),
            current?.timezoneOffset,
          )
        ? 'Yesterday'
        : null

  // Arrow keys step through days when focus is not inside a control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, select, textarea, [contenteditable], [role="tablist"], [role="menu"], [role="dialog"]',
        )
      )
        return
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const trendsRef = useRef<HTMLDivElement>(null)
  const showSection = (next: Section) => {
    setSection(next)
    // On phones the tiles fill the screen, so bring the detail into view.
    if (window.matchMedia('(max-width: 760px)').matches)
      requestAnimationFrame(() =>
        trendsRef.current?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 'instant'
            : 'smooth',
          block: 'start',
        }),
      )
  }
  const metric = primaryMetric[section]
  const metricAverage = mean(days.map((d) => d[metric]))
  const tone = recoveryTone(current?.recovery)
  const account = data && !preview && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="avatar" aria-label="Account menu">
          {data.user.firstName[0]}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="menu">
        <DropdownMenuLabel>
          <span className="menu-name">
            {data.user.firstName} {data.user.lastName}
          </span>
          <span className="menu-email">{data.user.email}</span>
        </DropdownMenuLabel>
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
  )

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="FORM home">
          FORM
        </a>
        {data && (
          <nav className="nav" aria-label="Sections">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className="nav-item"
                onClick={() => {
                  setSection(id)
                  window.scrollTo({ top: 0, behavior: 'instant' })
                }}
                aria-current={section === id ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
        <div className="topbar-right">
          {data &&
            (preview ? (
              <span className="pill">Demo data</span>
            ) : (
              <div className="sync">
                <span className="sync-label">
                  {syncing
                    ? 'Syncing…'
                    : data.syncedAt
                      ? `Synced ${clock(data.syncedAt)}`
                      : 'Not synced yet'}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="icon-btn"
                      aria-label="Sync now"
                      onClick={() => sync.mutate()}
                      disabled={syncing || data.needsReconnect}
                    >
                      <RefreshCw
                        size={16}
                        className={syncing ? 'animate-spin' : undefined}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Sync now</TooltipContent>
                </Tooltip>
              </div>
            ))}
          {account}
        </div>
      </header>

      <main className="content">
        {preview && (
          <div className="notice">
            <span>
              You’re viewing demo data. Connect WHOOP to see your own.
            </span>
            <span className="notice-actions">
              <Button asChild size="sm" className="btn-primary">
                <a href="/api/auth/whoop">Connect WHOOP</a>
              </Button>
              <button
                className="icon-btn"
                onClick={() => setPreview(false)}
                aria-label="Exit demo"
              >
                <X size={16} />
              </button>
            </span>
          </div>
        )}
        {(authError || query.error || logout.error) && (
          <div role="alert" className="notice error">
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
            {(sync.error || data.syncError) && (
              <div className="notice error" role="alert">
                <span>
                  {sync.error?.message ??
                    (data.needsReconnect
                      ? 'Please renew your WHOOP connection to keep syncing.'
                      : 'Your last sync didn’t finish. Previously synced data is still available.')}
                </span>
                {data.needsReconnect && (
                  <Button asChild size="sm" className="btn-primary">
                    <a href="/api/auth/whoop">Reconnect WHOOP</a>
                  </Button>
                )}
              </div>
            )}
            {!latest && (
              <div className="notice">
                <span className="notice-inline">
                  <LoaderCircle
                    size={16}
                    className={syncing ? 'animate-spin' : undefined}
                  />
                  {syncing
                    ? 'Bringing in your last 90 days. The first sync can take a minute.'
                    : 'Nothing synced yet. Use Sync now to bring in your WHOOP data.'}
                </span>
              </div>
            )}

            <div className="day-nav" aria-live="polite">
              <button
                className="icon-btn"
                aria-label="Previous day"
                disabled={!canStep(-1)}
                onClick={() => step(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <DayPicker
                days={allDays}
                current={current}
                today={todayDate}
                onSelect={setSelectedDate}
                onLatest={() => setSelectedDate(null)}
              />
              <button
                className="icon-btn"
                aria-label="Next day"
                disabled={!canStep(1)}
                onClick={() => step(1)}
              >
                <ChevronRight size={18} />
              </button>
              {relativeDay && (
                <span className="day-caption">{relativeDay}</span>
              )}
              {current && latest && current.cycleId !== latest.cycleId && (
                <button
                  className="text-btn"
                  onClick={() => setSelectedDate(null)}
                >
                  Latest
                </button>
              )}
            </div>

            {section !== 'health' && (
              <div className="tiles">
                <Tile
                  label="Recovery"
                  value={format(current?.recovery)}
                  unit={current?.recovery == null ? '' : '%'}
                  color={tone.color}
                  ringValue={current?.recovery ?? null}
                  ringMax={100}
                  note={
                    current?.recovery == null
                      ? 'Not scored yet'
                      : `${tone.label} recovery`
                  }
                  active={section === 'recovery'}
                  onClick={() => showSection('recovery')}
                />
                <Tile
                  label="Strain"
                  value={format(current?.strain, 1)}
                  unit=""
                  color={palette.strain}
                  ringValue={current?.strain ?? null}
                  ringMax={21}
                  note={
                    current?.calories == null
                      ? 'Not scored yet'
                      : `${Math.round(current.calories).toLocaleString()} kcal expended`
                  }
                  active={section === 'activity'}
                  onClick={() => showSection('activity')}
                />
                <Tile
                  label="Sleep"
                  value={format(current?.sleepPerformance)}
                  unit={current?.sleepPerformance == null ? '' : '%'}
                  color={palette.sleep}
                  ringValue={current?.sleepPerformance ?? null}
                  ringMax={100}
                  note={
                    current?.sleepHours == null
                      ? 'Not scored yet'
                      : current.sleepNeededHours == null
                        ? `${duration(current.sleepHours)} asleep`
                        : `${duration(current.sleepHours)} of ${duration(current.sleepNeededHours)} needed`
                  }
                  active={section === 'sleep'}
                  onClick={() => showSection('sleep')}
                />
              </div>
            )}

            <div className="section-row" ref={trendsRef}>
              <h2>{section === 'health' ? 'Health Monitor' : 'Trends'}</h2>
              <Tabs
                value={String(range)}
                onValueChange={(value) => setRange(Number(value))}
              >
                <TabsList aria-label="Trend date range" className="segmented">
                  {[7, 30, 90].map((n) => (
                    <TabsTrigger key={n} value={String(n)}>
                      {n} days
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="section-body" key={section}>
              {section === 'health' ? (
                <HealthMonitor days={allDays} current={current} range={range} />
              ) : (
                <>
                  <div className="grid-main">
                    <section className="panel primary-trend">
                      <PanelHeading
                        title={
                          section === 'sleep'
                            ? 'Time asleep'
                            : section === 'activity'
                              ? 'Daily strain'
                              : 'Recovery'
                        }
                        description={`${range} days through ${dateLabel(periodEnd)}`}
                        tip={
                          section === 'activity'
                            ? 'WHOOP strain uses a nonlinear 0–21 scale. Daily strain is not the sum of workout strain.'
                            : 'Only scored days are plotted. Missing values are never treated as zero.'
                        }
                      />
                      <div className="chart-stat">
                        <strong>
                          {metricAverage == null
                            ? '—'
                            : trendMetrics[metric].format(metricAverage)}
                        </strong>
                        <span>average</span>
                      </div>
                      <TrendChart days={days} metric={metric} />
                      <div className="panel-foot">
                        <span>{days.length} physiological days recorded</span>
                        <span>Source: WHOOP</span>
                      </div>
                    </section>

                    <section className="panel signals-panel">
                      <PanelHeading
                        title={
                          section === 'sleep' ? 'Sleep quality' : 'Signals'
                        }
                        description={
                          current
                            ? dateLabel(current.date, {
                                month: 'long',
                                day: 'numeric',
                              })
                            : 'Selected day'
                        }
                        tip="Compared with your own recent average. These are measurements, not diagnoses."
                      />
                      <div className="signals">
                        {section === 'sleep' ? (
                          <>
                            <Signal
                              label="Sleep efficiency"
                              value={current?.sleepEfficiency}
                              baseline={mean(
                                days.map((d) => d.sleepEfficiency),
                              )}
                              format={(v) => `${Math.round(v)}%`}
                              better="up"
                            />
                            <Signal
                              label="Sleep consistency"
                              value={current?.sleepConsistency}
                              baseline={mean(
                                days.map((d) => d.sleepConsistency),
                              )}
                              format={(v) => `${Math.round(v)}%`}
                              better="up"
                            />
                            <Signal
                              label="Restorative sleep"
                              value={
                                current?.deepHours != null &&
                                current?.remHours != null
                                  ? current.deepHours + current.remHours
                                  : null
                              }
                              baseline={mean(
                                days.map((d) =>
                                  d.deepHours != null && d.remHours != null
                                    ? d.deepHours + d.remHours
                                    : null,
                                ),
                              )}
                              format={duration}
                              epsilon={1 / 60}
                              better="up"
                            />
                            <Signal
                              label="Respiratory rate"
                              value={current?.respiratoryRate}
                              baseline={mean(
                                days.map((d) => d.respiratoryRate),
                              )}
                              format={(v) => `${v.toFixed(1)} rpm`}
                              epsilon={0.3}
                            />
                          </>
                        ) : section === 'activity' ? (
                          <>
                            <Signal
                              label="Energy expended"
                              value={current?.calories}
                              baseline={mean(days.map((d) => d.calories))}
                              format={(v) =>
                                `${Math.round(v).toLocaleString()} kcal`
                              }
                              epsilon={25}
                            />
                            <Signal
                              label="Sessions"
                              value={current ? todaysWorkouts.length : null}
                              baseline={
                                days.length
                                  ? workouts.length / days.length
                                  : null
                              }
                              format={(v) =>
                                Number.isInteger(v) ? String(v) : v.toFixed(1)
                              }
                            />
                            <Signal
                              label="Daily average heart rate"
                              value={current?.averageHeartRate}
                              baseline={mean(
                                days.map((d) => d.averageHeartRate),
                              )}
                              format={(v) => `${Math.round(v)} bpm`}
                            />
                          </>
                        ) : (
                          <>
                            <Signal
                              label="Heart rate variability"
                              value={current?.hrv}
                              baseline={mean(days.map((d) => d.hrv))}
                              format={(v) => `${Math.round(v)} ms`}
                              better="up"
                            />
                            <Signal
                              label="Resting heart rate"
                              value={current?.rhr}
                              baseline={mean(days.map((d) => d.rhr))}
                              format={(v) => `${Math.round(v)} bpm`}
                              better="down"
                            />
                            <Signal
                              label="Respiratory rate"
                              value={current?.respiratoryRate}
                              baseline={mean(
                                days.map((d) => d.respiratoryRate),
                              )}
                              format={(v) => `${v.toFixed(1)} rpm`}
                              epsilon={0.3}
                            />
                            {section === 'recovery' && (
                              <>
                                <Signal
                                  label="Blood oxygen"
                                  value={current?.spo2}
                                  baseline={mean(days.map((d) => d.spo2))}
                                  format={(v) => `${v.toFixed(1)}%`}
                                  epsilon={0.3}
                                />
                                <Signal
                                  label="Skin temperature"
                                  value={current?.skinTemp}
                                  baseline={mean(days.map((d) => d.skinTemp))}
                                  format={(v) => `${v.toFixed(1)} °C`}
                                  epsilon={0.2}
                                />
                              </>
                            )}
                          </>
                        )}
                      </div>
                      <div className="panel-foot">
                        <span>Compared with your {range}-day average</span>
                        {(section === 'overview' || section === 'recovery') && (
                          <button
                            className="text-btn"
                            onClick={() => showSection('health')}
                          >
                            Health Monitor <ArrowRight size={13} aria-hidden />
                          </button>
                        )}
                      </div>
                    </section>
                  </div>

                  {section === 'recovery' ? (
                    <div className="grid-secondary">
                      <section className="panel">
                        <PanelHeading
                          title="Heart rate variability"
                          description="Your readings over time; explore personal comparisons in Health"
                        />
                        <TrendChart days={days} metric="hrv" height={200} />
                      </section>
                      <section className="panel">
                        <PanelHeading
                          title="Resting heart rate"
                          description="Your readings over time; explore personal comparisons in Health"
                        />
                        <TrendChart days={days} metric="rhr" height={200} />
                      </section>
                    </div>
                  ) : section === 'sleep' ? (
                    <div className="grid-secondary">
                      <NightPanel day={current} />
                      <SleepBreakdownPanel days={days} />
                    </div>
                  ) : section === 'activity' ? (
                    <>
                      <div className="grid-secondary">
                        <DailyHeartRate day={current} />
                        <WorkoutsPanel
                          key={current?.cycleId}
                          workouts={todaysWorkouts}
                          range={1}
                        />
                      </div>
                      <div className="grid-secondary single">
                        <WorkoutsPanel
                          key={`${periodEnd}-${range}`}
                          workouts={workouts}
                          range={range}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="grid-secondary">
                      <SleepBreakdownPanel days={days} />
                      <WorkoutsPanel
                        workouts={workouts}
                        range={range}
                        limit={3}
                        onViewAll={() => setSection('activity')}
                      />
                    </div>
                  )}
                  {section === 'sleep' && (
                    <SleepDetails day={current} records={data.records} />
                  )}
                </>
              )}
            </div>
            {section !== 'health' && <DailyTable days={days} />}
            <footer className="page-foot">
              {preview
                ? 'Illustrative demo. Not real health data.'
                : 'Data from WHOOP. Days follow your physiological cycles, labeled by wake-up date.'}
            </footer>
          </>
        )}
      </main>
    </div>
  )
}

function Welcome({ onPreview }: { onPreview: () => void }) {
  return (
    <section className="welcome">
      <h1>See your body’s signals clearly.</h1>
      <p>
        FORM syncs the last 90 days of recovery, sleep, and strain from your
        WHOOP account and keeps them private to you.
      </p>
      <div className="welcome-actions">
        <Button asChild size="lg" className="btn-primary">
          <a href="/api/auth/whoop">
            Connect WHOOP <ArrowRight size={16} />
          </a>
        </Button>
        <button className="btn-ghost" onClick={onPreview}>
          Explore the demo
        </button>
      </div>
      <p className="welcome-trust">
        <ShieldCheck size={15} aria-hidden />
        Read-only access. Stored only for your account. Disconnect any time.
      </p>
      <dl className="welcome-list">
        <div>
          <dt>Recovery</dt>
          <dd>Score, HRV, and resting heart rate against your own baseline.</dd>
        </div>
        <div>
          <dt>Sleep</dt>
          <dd>Stages, sleep need, and consistency, night by night.</dd>
        </div>
        <div>
          <dt>Strain</dt>
          <dd>Daily load and every workout, in context.</dd>
        </div>
      </dl>
    </section>
  )
}

function Tile({
  label,
  value,
  unit,
  color,
  ringValue,
  ringMax,
  note,
  active,
  onClick,
}: {
  label: string
  value: string
  unit: string
  color: string
  ringValue: number | null
  ringMax: number
  note: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className="tile"
      data-active={active || undefined}
      onClick={onClick}
    >
      <span className="tile-label">
        {label}
        <ChevronRight size={15} aria-hidden />
      </span>
      <span className="tile-main">
        <span className="tile-value">
          {value}
          {unit && <span className="tile-unit">{unit}</span>}
        </span>
        <MetricRing value={ringValue} max={ringMax} color={color} />
      </span>
      <span className="tile-note">
        <i style={{ background: ringValue == null ? palette.none : color }} />
        {note}
      </span>
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
                <button className="tip" aria-label={`About ${title}`}>
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
  baseline,
  format,
  better = 'neutral',
  epsilon = 0.5,
  emptyText,
}: {
  label: string
  value: number | null | undefined
  baseline: number | null
  format: (value: number) => string
  better?: 'up' | 'down' | 'neutral'
  epsilon?: number
  emptyText?: string
}) {
  const difference = value != null && baseline != null ? value - baseline : null
  const flat = difference != null && Math.abs(difference) < epsilon
  const toneClass =
    difference == null || flat || better === 'neutral'
      ? undefined
      : difference > 0 === (better === 'up')
        ? 'good'
        : 'watch'
  return (
    <div className="signal">
      <span className="signal-label">{label}</span>
      <strong className="signal-value">
        {value == null ? '—' : format(value)}
      </strong>
      <span className={cn('signal-delta', toneClass)}>
        {value == null ? (
          (emptyText ?? 'No reading')
        ) : difference == null ? (
          'No baseline yet'
        ) : flat ? (
          'At your average'
        ) : (
          <>
            {difference > 0 ? (
              <MoveUpRight size={13} aria-hidden />
            ) : (
              <MoveDownRight size={13} aria-hidden />
            )}
            {difference > 0 ? '+' : '−'}
            {format(Math.abs(difference))} vs. average
          </>
        )}
      </span>
    </div>
  )
}

function NightPanel({ day }: { day: DailyStats | undefined }) {
  const hasSleep = day?.sleepHours != null
  const need = day?.sleepNeededHours ?? null
  const ratio = hasSleep && need ? Math.min(1, day.sleepHours! / need) : null
  return (
    <section className="panel">
      <PanelHeading
        title={
          day?.date === localDate(new Date().toISOString(), day?.timezoneOffset)
            ? 'Last night'
            : 'Selected night'
        }
        description={
          day?.sleepStart && day.sleepEnd
            ? `${localTime(day.sleepStart, day.timezoneOffset)} – ${localTime(day.sleepEnd, day.timezoneOffset)}`
            : day
              ? dateLabel(day.date, { month: 'long', day: 'numeric' })
              : 'Selected night'
        }
      />
      {hasSleep && day ? (
        <div className="night">
          <div className="chart-stat">
            <strong>{duration(day.sleepHours)}</strong>
            <span>
              asleep{need != null ? ` of ${duration(need)} needed` : ''}
            </span>
          </div>
          {ratio != null && (
            <div
              className="meter"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratio * 100)}
              aria-label="Sleep need met"
            >
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
          )}
          <SleepStagesBar day={day} />
        </div>
      ) : (
        <p className="empty">No scored sleep for this day.</p>
      )}
    </section>
  )
}

function SleepBreakdownPanel({ days }: { days: DailyStats[] }) {
  return (
    <section className="panel">
      <PanelHeading
        title="Sleep stages"
        description={`${duration(mean(days.map((d) => d.sleepHours)))} average per night`}
        action={
          <ul className="legend" aria-label="Sleep stages">
            <li>
              <i style={{ background: palette.deep }} /> Deep
            </li>
            <li>
              <i style={{ background: palette.rem }} /> REM
            </li>
            <li>
              <i style={{ background: palette.light }} /> Light
            </li>
          </ul>
        }
      />
      <SleepChart days={days} />
      <div className="panel-foot">
        <span>Nightly stage totals</span>
        <span>Naps excluded</span>
      </div>
    </section>
  )
}

function WorkoutsPanel({
  workouts,
  range,
  limit,
  onViewAll,
}: {
  workouts: WhoopRecord[]
  range: number
  limit?: number
  onViewAll?: () => void
}) {
  const [visibleCount, setVisibleCount] = useState(6)
  const shown = workouts.slice(0, limit ?? visibleCount)
  const averageStrain = mean(
    workouts
      .filter((w) => w.score_state === 'SCORED')
      .map((w) => w.score?.strain),
  )
  return (
    <section className="panel">
      <PanelHeading
        title={range === 1 ? 'Selected-day activities' : 'Activities'}
        description={`${workouts.length} ${workouts.length === 1 ? 'session' : 'sessions'} ${range === 1 ? 'on the selected day' : `in the ${range}-day period`}`}
        action={
          onViewAll && workouts.length > (limit ?? 0) ? (
            <button className="text-btn" onClick={onViewAll}>
              View all <ArrowRight size={14} aria-hidden />
            </button>
          ) : undefined
        }
      />
      <div className="workouts">
        {shown.length ? (
          shown.map((workout) => (
            <WorkoutRow key={String(workout.id)} workout={workout} />
          ))
        ) : (
          <p className="empty">Recorded workouts will appear here.</p>
        )}
      </div>
      {!limit && workouts.length > 6 && (
        <div className="workout-pagination">
          <span>
            Showing {shown.length} of {workouts.length}
          </span>
          <button
            className="text-btn"
            onClick={() =>
              setVisibleCount(
                shown.length < workouts.length ? visibleCount + 6 : 6,
              )
            }
          >
            {shown.length < workouts.length
              ? `Show ${Math.min(6, workouts.length - shown.length)} more`
              : 'Show fewer'}
          </button>
        </div>
      )}
      <div className="panel-foot">
        <span>Average session strain</span>
        <strong>{format(averageStrain, 1)}</strong>
      </div>
    </section>
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
    <details className="workout">
      <summary>
        <span className="workout-icon">
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <span className="workout-info">
          <strong>{sport}</strong>
          <span>
            {workout.start
              ? `${dateLabel(localDate(workout.start, workout.timezone_offset), { weekday: 'short', month: 'short', day: 'numeric' })} · ${localTime(workout.start, workout.timezone_offset)}`
              : ''}
            {workoutHours != null && ` · ${duration(workoutHours)}`}
          </span>
        </span>
        <span className="workout-strain">
          <strong>{format(score?.strain, 1)}</strong>
          <small>strain</small>
        </span>
        <ChevronDown size={16} aria-hidden />
      </summary>
      <dl className="workout-detail">
        <div>
          <dt>Average HR</dt>
          <dd>{format(score?.average_heart_rate)} bpm</dd>
        </div>
        <div>
          <dt>Max HR</dt>
          <dd>{format(score?.max_heart_rate)} bpm</dd>
        </div>
        <div>
          <dt>Energy</dt>
          <dd>
            {score?.kilojoule == null
              ? '—'
              : Math.round(score.kilojoule / 4.184).toLocaleString()}{' '}
            kcal
          </dd>
        </div>
        {score?.distance_meter != null && (
          <div>
            <dt>Distance</dt>
            <dd>{(score.distance_meter / 1000).toFixed(2)} km</dd>
          </div>
        )}
      </dl>
      <WorkoutDetails workout={workout} />
    </details>
  )
}

function DailyTable({ days }: { days: DailyStats[] }) {
  return (
    <details className="daily-table">
      <summary>
        Daily values <ChevronDown size={15} aria-hidden />
      </summary>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Daily values table"
      >
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
                'Respiratory rate',
                'Blood oxygen',
                'Skin temperature',
                'Daily average HR',
                'Daily max HR',
                'Sleep debt',
                'Disturbances',
                'Sleep cycles',
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
                <td>
                  {day.recovery == null ? (
                    '—'
                  ) : (
                    <span className="cell-status">
                      <i
                        style={{ background: recoveryTone(day.recovery).color }}
                      />
                      {day.recovery}%
                    </span>
                  )}
                </td>
                <td>{format(day.strain, 1)}</td>
                <td>{duration(day.sleepHours)}</td>
                <td>{duration(day.deepHours)}</td>
                <td>{duration(day.remHours)}</td>
                <td>{duration(day.lightHours)}</td>
                <td>{day.hrv == null ? '—' : `${Math.round(day.hrv)} ms`}</td>
                <td>{day.rhr == null ? '—' : `${Math.round(day.rhr)} bpm`}</td>
                <td>
                  {day.respiratoryRate == null
                    ? '—'
                    : `${day.respiratoryRate.toFixed(1)} rpm`}
                </td>
                <td>{day.spo2 == null ? '—' : `${day.spo2.toFixed(1)}%`}</td>
                <td>
                  {day.skinTemp == null ? '—' : `${day.skinTemp.toFixed(1)} °C`}
                </td>
                <td>
                  {day.averageHeartRate == null
                    ? '—'
                    : `${Math.round(day.averageHeartRate)} bpm`}
                </td>
                <td>
                  {day.maxHeartRate == null
                    ? '—'
                    : `${Math.round(day.maxHeartRate)} bpm`}
                </td>
                <td>{duration(day.sleepDebtHours)}</td>
                <td>{day.disturbanceCount ?? '—'}</td>
                <td>{day.sleepCycleCount ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!days.length && (
          <p className="empty">No recorded days in this range.</p>
        )}
      </div>
    </details>
  )
}

function LoadingDashboard() {
  return (
    <div className="loading" role="status" aria-label="Loading dashboard">
      <Skeleton className="h-8 w-72 max-w-full" />
      <div className="tiles">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}
