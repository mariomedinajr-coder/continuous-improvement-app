import { useState, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, ChevronRight, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {
  LeaderboardEntry,
  TeamLeaderboardEntry,
  TeamMemberContribution,
  PointAssignment,
} from '../types'

const CURRENT_YEAR = new Date().getFullYear()

type Tab = 'individual' | 'teams'

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />
  if (rank === 2) return <Trophy size={20} className="text-gray-400" />
  if (rank === 3) return <Trophy size={20} className="text-orange-500" />
  return null
}

export default function Leaderboard() {
  const { t } = useTranslation()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [tab, setTab] = useState<Tab>('individual')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [teamEntries, setTeamEntries] = useState<TeamLeaderboardEntry[]>([])
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleTeam = (teamId: string) =>
    setExpandedTeams(prev => {
      const next = new Set(prev)
      next.has(teamId) ? next.delete(teamId) : next.add(teamId)
      return next
    })

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

  useEffect(() => {
    if (tab !== 'teams') return

    async function fetchTeamLeaderboard() {
      setLoading(true)
      setError(null)
      try {
        // All teams (so zero-point teams still rank), the full roster, and this
        // year's point assignments — aggregated into team + per-member totals.
        const [teamsRes, membersRes, assignRes] = await Promise.all([
          supabase.from('teams').select('id, name, area'),
          supabase.from('users').select('id, name, team_id').not('team_id', 'is', null),
          supabase
            .from('point_assignments')
            .select('points, improvement_id, user_id')
            .gte('created_at', `${year}-01-01`)
            .lt('created_at', `${year + 1}-01-01`),
        ])

        if (teamsRes.error) throw teamsRes.error
        if (membersRes.error) throw membersRes.error
        if (assignRes.error) throw assignRes.error

        const teams = (teamsRes.data ?? []) as { id: string; name: string; area: string }[]
        const members = (membersRes.data ?? []) as { id: string; name: string; team_id: string }[]
        const assigns = (assignRes.data ?? []) as { points: number; improvement_id: string; user_id: string }[]

        // Points + distinct improvements per user, this year
        const userAgg = new Map<string, { points: number; improvements: Set<string> }>()
        for (const a of assigns) {
          const existing = userAgg.get(a.user_id)
          if (existing) {
            existing.points += a.points
            existing.improvements.add(a.improvement_id)
          } else {
            userAgg.set(a.user_id, { points: a.points, improvements: new Set([a.improvement_id]) })
          }
        }

        // Roster grouped by team
        const byTeam = new Map<string, { id: string; name: string }[]>()
        for (const m of members) {
          const arr = byTeam.get(m.team_id) ?? []
          arr.push({ id: m.id, name: m.name })
          byTeam.set(m.team_id, arr)
        }

        const sorted: TeamLeaderboardEntry[] = teams
          .map(team => {
            const roster = byTeam.get(team.id) ?? []
            const teamImprovements = new Set<string>()
            const memberContribs: TeamMemberContribution[] = roster
              .map(mem => {
                const agg = userAgg.get(mem.id)
                if (agg) agg.improvements.forEach(id => teamImprovements.add(id))
                return {
                  user_id: mem.id,
                  user_name: mem.name,
                  total_points: agg?.points ?? 0,
                  improvements_count: agg?.improvements.size ?? 0,
                }
              })
              .sort((a, b) => b.total_points - a.total_points || a.user_name.localeCompare(b.user_name))

            return {
              team_id: team.id,
              team_name: team.name,
              area: team.area,
              total_points: memberContribs.reduce((s, m) => s + m.total_points, 0),
              members_count: roster.length,
              improvements_count: teamImprovements.size,
              rank: 0,
              members: memberContribs,
            }
          })
          .sort((a, b) => b.total_points - a.total_points || a.team_name.localeCompare(b.team_name))
          .map((entry, idx) => ({ ...entry, rank: idx + 1 }))

        setTeamEntries(sorted)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchTeamLeaderboard()
  }, [year, tab])

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

      {/* Tabs */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {(['individual', 'teams'] as Tab[]).map(tk => (
          <button
            key={tk}
            onClick={() => setTab(tk)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === tk ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t(`leaderboard.tabs.${tk}`)}
          </button>
        ))}
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
        ) : tab === 'individual' ? (
          entries.length === 0 ? (
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
          )
        ) : teamEntries.length === 0 ? (
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
                    {t('leaderboard.team')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('leaderboard.area')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('leaderboard.membersCount')}
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
                {teamEntries.map((entry) => {
                  const isExpanded = expandedTeams.has(entry.team_id)
                  return (
                  <Fragment key={entry.team_id}>
                  <tr
                    onClick={() => entry.members_count > 0 && toggleTeam(entry.team_id)}
                    className={`${
                      entry.rank === 1
                        ? 'bg-yellow-50 hover:bg-yellow-100'
                        : entry.rank === 2
                        ? 'bg-gray-50 hover:bg-gray-100'
                        : entry.rank === 3
                        ? 'bg-orange-50 hover:bg-orange-100'
                        : 'hover:bg-gray-50'
                    } ${entry.members_count > 0 ? 'cursor-pointer' : ''}`}
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
                      <div className="flex items-center gap-2">
                        {entry.members_count > 0 ? (
                          isExpanded
                            ? <ChevronDown size={16} className="text-gray-400 shrink-0" />
                            : <ChevronRight size={16} className="text-gray-400 shrink-0" />
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-gray-900">{entry.team_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{entry.area || '—'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-gray-700">{entry.members_count}</span>
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
                  {isExpanded && (
                    <tr className="bg-gray-50/60">
                      <td colSpan={6} className="px-6 py-0">
                        <div className="py-3 pl-8">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                            {t('leaderboard.memberBreakdown')}
                          </p>
                          <ul className="divide-y divide-gray-200/70">
                            {entry.members.map((m) => (
                              <li key={m.user_id} className="flex items-center justify-between py-1.5">
                                <span className="text-sm text-gray-700">{m.user_name}</span>
                                <span className="flex items-center gap-4">
                                  <span className="text-xs text-gray-400">
                                    {m.improvements_count} {t('leaderboard.improvements').toLowerCase()}
                                  </span>
                                  <span className={`text-sm font-semibold tabular-nums ${m.total_points > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                                    {m.total_points} {t('common.points')}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
