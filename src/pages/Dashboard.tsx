import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import { TrendingUp, CheckCircle2, Clock, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Improvement, PointAssignment, ImprovementStatus, SQDCMCategory } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardData {
  improvements: Improvement[]
  pointAssignments: PointAssignment[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ImprovementStatus, string> = {
  submitted:    '#3b82f6',
  under_review: '#eab308',
  approved:     '#22c55e',
  implemented:  '#10b981',
  rejected:     '#ef4444',
  draft:        '#6b7280',
}

const STATUS_BADGE_CLASSES: Record<ImprovementStatus, string> = {
  submitted:    'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved:     'bg-green-100 text-green-700',
  implemented:  'bg-emerald-100 text-emerald-700',
  rejected:     'bg-red-100 text-red-700',
  draft:        'bg-gray-100 text-gray-600',
}

const SQDCM_CATEGORIES: SQDCMCategory[] = ['S', 'Q', 'D', 'C', 'M']

const SQDCM_COLORS: Record<SQDCMCategory, string> = {
  S: '#3b82f6',
  Q: '#8b5cf6',
  D: '#f59e0b',
  C: '#10b981',
  M: '#f43f5e',
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleString('default', { month: 'short', year: '2-digit' })
}

function getLast12MonthKeys(): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ImprovementStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  )
}

// ── Metric Card ────────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  colorClass: string
}

function MetricCard({ label, value, icon, colorClass }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [impResult, ptResult] = await Promise.all([
        supabase
          .from('improvements')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('point_assignments')
          .select('*'),
      ])

      setData({
        improvements: (impResult.data ?? []) as Improvement[],
        pointAssignments: (ptResult.data ?? []) as PointAssignment[],
      })
      setLoading(false)
    }
    fetchData()
  }, [])

  // ── Derived metrics (useMemo, no useState for derived) ─────────────────────

  // Drafts are unsubmitted work-in-progress — exclude them from the overview.
  const improvements = useMemo(
    () => (data?.improvements ?? []).filter(i => i.status !== 'draft'),
    [data],
  )

  const totalImprovements = useMemo(() => improvements.length, [improvements])

  const implementedCount = useMemo(
    () => improvements.filter(i => i.status === 'implemented').length,
    [improvements],
  )

  const inProgressCount = useMemo(
    () =>
      improvements.filter(i =>
        (['submitted', 'under_review', 'approved'] as ImprovementStatus[]).includes(i.status),
      ).length,
    [improvements],
  )

  const totalPoints = useMemo(
    () => data?.pointAssignments.reduce((acc, pa) => acc + (pa.points ?? 0), 0) ?? 0,
    [data],
  )

  const recentImprovements = useMemo(
    () => improvements.slice(0, 5),
    [improvements],
  )

  // Bar chart — SQDCM counts
  const sqdcmChartData = useMemo(() => {
    const counts: Record<SQDCMCategory, number> = { S: 0, Q: 0, D: 0, C: 0, M: 0 }
    for (const imp of improvements) {
      for (const cat of (imp.sqdcm_targeted ?? [])) {
        if (cat in counts) counts[cat as SQDCMCategory]++
      }
    }
    return SQDCM_CATEGORIES.map(cat => ({
      category: cat,
      count: counts[cat],
      fill: SQDCM_COLORS[cat],
    }))
  }, [improvements])

  // Pie chart — by status
  const statusChartData = useMemo(() => {
    const counts: Partial<Record<ImprovementStatus, number>> = {}
    for (const imp of improvements) {
      counts[imp.status] = (counts[imp.status] ?? 0) + 1
    }
    return (Object.entries(counts) as [ImprovementStatus, number][]).map(([status, value]) => ({
      name: status,
      value,
      fill: STATUS_COLORS[status],
    }))
  }, [improvements])

  // Line chart — monthly trend (last 12 months)
  const monthlyTrendData = useMemo(() => {
    const keys = getLast12MonthKeys()
    const countByMonth: Record<string, number> = {}
    for (const imp of improvements) {
      const key = getMonthKey(imp.created_at)
      countByMonth[key] = (countByMonth[key] ?? 0) + 1
    }
    return keys.map(key => ({
      month: formatMonthLabel(key),
      count: countByMonth[key] ?? 0,
    }))
  }, [improvements])

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-spin border-4 border-blue-600 border-t-transparent rounded-full w-8 h-8 mx-auto mt-20" />
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <p className="text-gray-500 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label={t('dashboard.totalImprovements')}
          value={totalImprovements}
          icon={<TrendingUp size={22} className="text-blue-600" />}
          colorClass="bg-blue-50"
        />
        <MetricCard
          label={t('dashboard.implemented')}
          value={implementedCount}
          icon={<CheckCircle2 size={22} className="text-emerald-600" />}
          colorClass="bg-emerald-50"
        />
        <MetricCard
          label={t('dashboard.inProgress')}
          value={inProgressCount}
          icon={<Clock size={22} className="text-yellow-600" />}
          colorClass="bg-yellow-50"
        />
        <MetricCard
          label={t('dashboard.totalPoints')}
          value={totalPoints.toLocaleString()}
          icon={<Star size={22} className="text-purple-600" />}
          colorClass="bg-purple-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SQDCM Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t('dashboard.bySQDCM')}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sqdcmChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" tick={{ fontSize: 13, fontWeight: 600 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [value, t('dashboard.totalImprovements')]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {sqdcmChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t('dashboard.byStatus')}</h2>
          {statusChartData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              {t('improvements.noResults')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${t(`status.${name ?? ''}`)} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => t(`status.${value}`)}
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, name) => [value, t(`status.${name}`)]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly Trend Line Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t('dashboard.monthlyTrend')}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyTrendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [value, t('dashboard.totalImprovements')]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Improvements Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('dashboard.recentImprovements')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left font-medium">{t('common.name')}</th>
                <th className="px-6 py-3 text-left font-medium">{t('common.area')}</th>
                <th className="px-6 py-3 text-left font-medium">{t('common.status')}</th>
                <th className="px-6 py-3 text-left font-medium">{t('common.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentImprovements.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                    {t('improvements.noResults')}
                  </td>
                </tr>
              ) : (
                recentImprovements.map(imp => (
                  <tr key={imp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900 max-w-xs truncate">
                      {imp.title}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{imp.area}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={imp.status} />
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {imp.date_submitted
                        ? new Date(imp.date_submitted).toLocaleDateString()
                        : new Date(imp.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
