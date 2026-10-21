import type { Lang } from '@/lib/i18n'
import { num } from '@/lib/i18n'

/**
 * نمودارهای پنل — SVG سمت سرور، بدون کتابخانه.
 *
 * یک سری = یک رنگ (سرخابی برند، روی سطح تیره با validator چک شده)، پس لجند
 * لازم نیست؛ عنوان کارت می‌گوید چه چیزی رسم شده. میله‌ها نازک با سر گرد ۴px و
 * پایه‌ی صاف، خطوط راهنما مویی. راهنمای هاور با <title> روی ناحیه‌ی بزرگ‌تر از
 * میله، و جدول همان داده برای صفحه‌خوان.
 */
const BAR = '#e1306c'
const GRID = 'rgba(255,255,255,0.07)'

export interface DayPoint {
  day: string // YYYY-MM-DD
  count: number
}

const dayLabel = (lang: Lang, iso: string) =>
  new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB', { month: 'short', day: 'numeric' }).format(new Date(iso + 'T12:00:00Z'))

/** گرد کردن سقف محور به عددی خوانا */
function niceMax(v: number): number {
  if (v <= 4) return 4
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

export function DailyBars({ data, lang, tableLabel, dayCol, countCol }: { data: DayPoint[]; lang: Lang; tableLabel: string; dayCol: string; countCol: string }) {
  const W = 600
  const H = 170
  const top = 10
  const bottom = 24
  const side = 30
  const plotW = W - side - 6
  const plotH = H - top - bottom
  const max = niceMax(Math.max(0, ...data.map((d) => d.count)))
  const slot = plotW / data.length
  const bw = Math.min(14, slot - 2)
  const rtl = lang === 'fa'
  // در فارسی زمان از راست به چپ جلو می‌رود
  // محور اعداد سمت «شروع» خط: راست در فارسی، چپ در انگلیسی
  const x0 = rtl ? 6 : side
  const xOf = (i: number) => (rtl ? x0 + plotW - (i + 1) * slot : x0 + i * slot)
  const yOf = (v: number) => top + plotH - (v / max) * plotH
  const ticks = [0, max / 2, max]
  const labelIdx = [0, Math.floor(data.length / 2), data.length - 1]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={tableLabel} style={{ direction: 'ltr' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x0} x2={x0 + plotW} y1={yOf(t)} y2={yOf(t)} stroke={GRID} strokeWidth="1" />
            <text x={rtl ? x0 + plotW + 6 : x0 - 6} y={yOf(t) + 4} textAnchor={rtl ? 'start' : 'end'} fontSize="10" fill="#6f6790">
              {num(lang, t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = xOf(i) + (slot - bw) / 2
          const y = yOf(d.count)
          const h = top + plotH - y
          const r = Math.min(4, h / 2)
          return (
            <g key={d.day} className="group">
              <rect x={xOf(i)} y={top} width={slot} height={plotH} fill="transparent">
                <title>{dayLabel(lang, d.day) + ': ' + num(lang, d.count)}</title>
              </rect>
              {d.count > 0 && (
                <path
                  className="pointer-events-none transition-opacity group-hover:opacity-80"
                  d={`M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${top + plotH} Z`}
                  fill={BAR}
                />
              )}
            </g>
          )
        })}
        {labelIdx.map((i) => (
          <text key={i} x={xOf(i) + slot / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#6f6790">
            {dayLabel(lang, data[i].day)}
          </text>
        ))}
      </svg>
      <details className="mt-2 text-[12px] text-dim">
        <summary className="cursor-pointer">{tableLabel}</summary>
        <table className="mt-2 w-full text-start">
          <thead>
            <tr>
              <th className="py-1 text-start font-normal">{dayCol}</th>
              <th className="py-1 text-start font-normal">{countCol}</th>
            </tr>
          </thead>
          <tbody>
            {data.filter((d) => d.count > 0).map((d) => (
              <tr key={d.day} className="border-t border-white/[0.05]">
                <td className="py-1">{dayLabel(lang, d.day)}</td>
                <td className="py-1 text-mist">{num(lang, d.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

/** میله‌های افقی با برچسب مستقیم — برای تفکیک نوع و پرکارترین جواب‌ها */
export function HBars({ items, lang }: { items: { label: string; value: number }[]; lang: Lang }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label} title={it.label + ': ' + num(lang, it.value)}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-mist">{it.label}</span>
            <span className="shrink-0 font-bold text-haze">{num(lang, it.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.05]">
            <div className="h-full rounded-e-[4px] rounded-s-none" style={{ width: Math.max(2, (it.value / max) * 100) + '%', background: BAR }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
