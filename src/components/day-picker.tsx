import { useEffect, useMemo, useRef, useState } from 'react'
import { Popover } from 'radix-ui'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { recoveryTone } from '@/lib/palette'
import type { DailyStats } from '@/lib/whoop'
import { cn } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')
const monthOf = (date: string) => date.slice(0, 7)
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}
function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function daysInMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
// Monday = 0 … Sunday = 6
const weekday = (date: string) =>
  (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
const longDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('en', {
    month: 'long',
    year: 'numeric',
  })

export function DayPicker({
  days,
  current,
  today,
  onSelect,
  onLatest,
}: {
  days: DailyStats[]
  current: DailyStats | undefined
  today: string
  onSelect: (cycleId: string) => void
  onLatest: () => void
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => monthOf(current?.date ?? today))
  const [focused, setFocused] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const byDate = useMemo(() => {
    const map = new Map<string, DailyStats>()
    for (const day of days) map.set(day.date, day)
    return map
  }, [days])
  const latest = days.at(-1)
  const minMonth = monthOf(days[0]?.date ?? today)
  const maxMonth = monthOf(latest?.date ?? today)

  const handleOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      const date = current?.date ?? today
      setMonth(monthOf(date))
      setFocused(date)
    }
  }
  const focusCell = (date: string | null) =>
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)
      ?.focus()
  useEffect(() => {
    if (open) focusCell(focused)
  }, [open, focused, month])

  const rows = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const first = `${month}-01`
    const cells: (string | null)[] = Array(weekday(first)).fill(null)
    for (let d = 1; d <= daysInMonth(month); d++)
      cells.push(`${y}-${pad(m)}-${pad(d)}`)
    while (cells.length % 7) cells.push(null)
    const out: (string | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
    return out
  }, [month])

  const moveFocus = (date: string) => {
    setMonth(monthOf(date))
    setFocused(date)
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!focused) return
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    if (event.key in steps) moveFocus(shiftDate(focused, steps[event.key]))
    else if (event.key === 'Home')
      moveFocus(shiftDate(focused, -weekday(focused)))
    else if (event.key === 'End')
      moveFocus(shiftDate(focused, 6 - weekday(focused)))
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const target = shiftMonth(month, event.key === 'PageUp' ? -1 : 1)
      const day = Math.min(Number(focused.slice(8)), daysInMonth(target))
      moveFocus(`${target}-${pad(day)}`)
    } else return
    event.preventDefault()
  }

  const label = current ? longDate(current.date) : 'No days recorded'
  return (
    <Popover.Root open={open} onOpenChange={handleOpen}>
      <h1 className="day-title">
        <Popover.Trigger asChild>
          <button
            className="day-trigger"
            aria-label={`Select physiological day, currently ${label}`}
            disabled={!days.length}
          >
            {label}
            <ChevronDown size={16} aria-hidden />
          </button>
        </Popover.Trigger>
      </h1>
      <Popover.Portal>
        <Popover.Content
          className="calendar"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            // Land on the selected day instead of the first control.
            event.preventDefault()
            focusCell(focused)
          }}
        >
          <div className="calendar-head">
            <button
              className="icon-btn"
              aria-label="Previous month"
              disabled={month <= minMonth}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <strong aria-live="polite">{monthLabel(month)}</strong>
            <button
              className="icon-btn"
              aria-label="Next month"
              disabled={month >= maxMonth}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div
            className="calendar-grid"
            role="grid"
            aria-label="Choose a day"
            ref={gridRef}
            onKeyDown={onKeyDown}
          >
            <div role="row" className="calendar-weekdays">
              {WEEKDAYS.map((w) => (
                <span role="columnheader" key={w}>
                  {w}
                </span>
              ))}
            </div>
            {rows.map((row, i) => (
              <div role="row" key={i}>
                {row.map((date, j) => {
                  if (!date) return <span role="gridcell" key={j} />
                  const day = byDate.get(date)
                  const selected = !!day && day.cycleId === current?.cycleId
                  const tone = recoveryTone(day?.recovery)
                  return (
                    <button
                      key={date}
                      role="gridcell"
                      data-date={date}
                      tabIndex={date === focused ? 0 : -1}
                      aria-disabled={day ? undefined : true}
                      aria-selected={selected}
                      aria-label={`${shortDate(date)}${
                        !day
                          ? ', no data'
                          : day.recovery == null
                            ? ', not scored'
                            : `, recovery ${Math.round(day.recovery)}%`
                      }`}
                      className={cn('calendar-day', date === today && 'today')}
                      onFocus={() => setFocused(date)}
                      onClick={() => {
                        if (!day) return
                        onSelect(day.cycleId)
                        setOpen(false)
                      }}
                    >
                      <span>{Number(date.slice(8))}</span>
                      {day && <i style={{ background: tone.color }} />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="calendar-foot">
            <ul className="legend" aria-label="Recovery">
              <li>
                <i style={{ background: recoveryTone(80).color }} /> High
              </li>
              <li>
                <i style={{ background: recoveryTone(50).color }} /> Moderate
              </li>
              <li>
                <i style={{ background: recoveryTone(20).color }} /> Low
              </li>
            </ul>
            <button
              className="text-btn"
              disabled={!latest || latest.cycleId === current?.cycleId}
              onClick={() => {
                onLatest()
                setOpen(false)
              }}
            >
              Latest
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
