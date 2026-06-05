import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { LeaderboardEntry, PointAssignment } from '../types'

const CURRENT_YEAR = new Date().getFullYear()

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />
  if (rank === 2) return <Trophy size={20} className="text-gray-400" />
  if (rank === 3) return <Trophy size={20} className="text-orange-500" />
  return null
}

export default function Leaderboard() {
  const { t } = useTranslation()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const yearOptions = [
    CURRENT_YEAR - 2,
    CURRENT_YEAR - 1,
    CURRENT_YEAR,
    CURRENT_YEAR + 1,
    CURRENT_YEAR + 2,
  ]

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('point_assignments')
          .select('*, user:users(id, name, area)')
          .gte('created_at', `${year}-01-01`)
          .lt('created_at', `${year + 1}-01-01`)

        if (fetchError) throw fetchError

        const rows = (data ?? []) as (PointAssignment & { user: { id: string; name: string; area: string } })[]

        // Aggregate by user_id
        const map = new Map<string, { user_name: string; area: string; total_points: number; improvement_ids: Set<string> }>()

        for (const row of rows) {
          if (!row.user) continue
          const existing = map.get(row.user_id)
          if (existing) {
            existing.total_points += row.points
            existing.improvement_ids.add(row.improvement_id)
          } else {
            map.set(row.user_id, {
              user_name: row.user.name,
              area: row.user.area,
              total_points: row.points,
              improvement_ids: new Set([row.improvement_id]),
            })
          }
        }

        // Build sorted leaderboard
        const sorted: LeaderboardEntry[] = Array.from(map.entries())
          .map(([user_id, agg]) => ({
            user_id,
            user_name: agg.user_name,
            area: agg.area,
            total_points: agg.total_points,
            improvements_count: agg.improvement_ids.size,
            rank: 0,
          }))
          .sort((a, b) => b.total_points - a.total_points)
          .map((entry, idx) => ({ ...entry, rank: idx + 1 }))

        setEntries(sorted)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [year])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('leaderboard.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('leaderboard.subtitle')}</p>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="year-select" className="text-sm font-medium text-gray-700">
            {t('leaderboard.year')}
          </label>
          <select
            id="year-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            {t('common.loading')}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            {t('leaderboard.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                    {t('leaderboard.rank')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('leaderboard.collaborator')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('leaderboard.area')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('leaderboard.improvements')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('leaderboard.points')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr
                    key={entry.user_id}
                    className={
                      entry.rank === 1
                        ? 'bg-yellow-50 hover:bg-yellow-100'
                        : entry.rank === 2
                        ? 'bg-gray-50 hover:bg-gray-100'
                        : entry.rank === 3
                        ? 'bg-orange-50 hover:bg-orange-100'
                        : 'hover:bg-gray-50'
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MedalIcon rank={entry.rank} />
                        <span
                          className={`text-sm font-bold ${
                            entry.rank === 1
                              ? 'text-yellow-600'
                              : entry.rank === 2
                              ? 'text-gray-500'
                              : entry.rank === 3
                              ? 'text-orange-600'
                              : 'text-gray-700'
                          }`}
                        >
                          #{entry.rank}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">{entry.user_name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{entry.area}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-gray-700">{entry.improvements_count}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-blue-700">
                        {entry.total_points}
                        <span className="text-xs font-normal text-blue-500">{t('common.points')}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
