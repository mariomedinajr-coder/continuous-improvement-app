import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PlusCircle, Eye, Search, ChevronLeft, ChevronRight, Presentation, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Improvement, ImprovementStatus } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ImprovementWithCount extends Improvement {
  participant_count: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const ALL_STATUSES: ImprovementStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'implemented',
  'rejected',
]

const STATUS_BADGE_CLASSES: Record<ImprovementStatus, string> = {
  submitted:    'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved:     'bg-green-100 text-green-700',
  implemented:  'bg-emerald-100 text-emerald-700',
  rejected:     'bg-red-100 text-red-700',
  draft:        'bg-gray-100 text-gray-600',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function StatusSelect({
  status,
  onChange,
  disabled,
}: {
  status: ImprovementStatus
  onChange: (next: ImprovementStatus) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as ImprovementStatus)}
      disabled={disabled}
      className={`text-xs font-medium rounded-full px-2.5 py-1 pr-7 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${STATUS_BADGE_CLASSES[status]}`}
    >
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-gray-800">
          {t(`status.${s}`)}
        </option>
      ))}
    </select>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Improvements() {
  const { t } = useTranslation()
  const { isManager } = useAuth()

  const [improvements, setImprovements] = useState<ImprovementWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ImprovementStatus | ''>('')
  const [page, setPage] = useState(1)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  async function handleStatusChange(id: string, next: ImprovementStatus) {
    const prev = improvements.find(i => i.id === id)?.status
    if (!prev || prev === next) return

    // Optimistic update
    setImprovements(curr =>
      curr.map(i => (i.id === id ? { ...i, status: next } : i)),
    )
    setSavingId(id)
    setErrorId(null)

    const { error } = await supabase
      .from('improvements')
      .update({ status: next })
      .eq('id', id)

    setSavingId(null)
    if (error) {
      // Rollback
      setImprovements(curr =>
        curr.map(i => (i.id === id ? { ...i, status: prev } : i)),
      )
      setErrorId(id)
      setTimeout(() => setErrorId(null), 3000)
    }
  }

  // Fetch improvements with participant count
  useEffect(() => {
    async function fetchImprovements() {
      setLoading(true)

      // Fetch improvements
      const { data: impData, error: impError } = await supabase
        .from('improvements')
        .select('*')
        .order('created_at', { ascending: false })

      if (impError || !impData) {
        setImprovements([])
        setLoading(false)
        return
      }

      // Fetch participant counts grouped by improvement_id
      const { data: participantData } = await supabase
        .from('improvement_participants')
        .select('improvement_id')

      // Build a count map
      const countMap: Record<string, number> = {}
      if (participantData) {
        for (const row of participantData) {
          const id = row.improvement_id as string
          countMap[id] = (countMap[id] ?? 0) + 1
        }
      }

      const merged: ImprovementWithCount[] = (impData as Improvement[]).map(imp => ({
        ...imp,
        participant_count: countMap[imp.id] ?? 0,
      }))

      setImprovements(merged)
      setLoading(false)
    }

    fetchImprovements()
  }, [])

  // ── Derived data (useMemo) ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return improvements.filter(imp => {
      const matchesSearch =
        search.trim() === '' ||
        imp.title.toLowerCase().includes(search.trim().toLowerCase())
      const matchesStatus =
        statusFilter === '' || imp.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [improvements, search, statusFilter])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    [filtered],
  )

  const currentPage = useMemo(
    () => Math.min(page, totalPages),
    [page, totalPages],
  )

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('improvements.title')}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {filtered.length} {t('improvements.title').toLowerCase()}
          </p>
        </div>
        <Link
          to="/improvements/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <PlusCircle size={16} />
          {t('improvements.new')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder={t('common.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ImprovementStatus | '')}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
        >
          <option value="">{t('improvements.filterByStatus')}</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin border-4 border-blue-600 border-t-transparent rounded-full w-8 h-8" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                    <th className="px-6 py-3 text-left font-medium">{t('common.name')}</th>
                    <th className="px-6 py-3 text-left font-medium">{t('common.area')}</th>
                    <th className="px-6 py-3 text-left font-medium">{t('common.status')}</th>
                    <th className="px-6 py-3 text-left font-medium">{t('common.date')}</th>
                    <th className="px-6 py-3 text-left font-medium">
                      {t('improvements.totalParticipants')}
                    </th>
                    <th className="px-6 py-3 text-left font-medium">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-16 text-center text-gray-400 text-sm"
                      >
                        {t('improvements.noResults')}
                      </td>
                    </tr>
                  ) : (
                    paginated.map(imp => (
                      <tr key={imp.id} className="hover:bg-gray-50 transition-colors">
                        {/* Title */}
                        <td className="px-6 py-3 font-medium text-gray-900 max-w-xs">
                          <span className="block truncate" title={imp.title}>
                            {imp.title}
                          </span>
                        </td>

                        {/* Area */}
                        <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                          {imp.area}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-3 whitespace-nowrap">
                          {isManager ? (
                            <div className="flex items-center gap-1.5">
                              <StatusSelect
                                status={imp.status}
                                onChange={(next) => handleStatusChange(imp.id, next)}
                                disabled={savingId === imp.id}
                              />
                              {errorId === imp.id && (
                                <span className="text-xs text-red-600">!</span>
                              )}
                            </div>
                          ) : (
                            <StatusBadge status={imp.status} />
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                          {imp.date_submitted
                            ? new Date(imp.date_submitted).toLocaleDateString()
                            : new Date(imp.created_at).toLocaleDateString()}
                        </td>

                        {/* Participants */}
                        <td className="px-6 py-3 text-gray-600 text-center">
                          {imp.participant_count}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            {imp.status === 'draft' ? (
                              <Link
                                to={`/improvements/${imp.id}/edit`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                              >
                                <Pencil size={13} />
                                {t('improvements.continueDraft')}
                              </Link>
                            ) : (
                              <Link
                                to={`/improvements/${imp.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <Eye size={13} />
                                {t('common.view')}
                              </Link>
                            )}
                            {isManager && imp.status !== 'draft' && (
                              <Link
                                to={`/improvements/${imp.id}/edit`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <Pencil size={13} />
                                {t('common.edit')}
                              </Link>
                            )}
                            <Link
                              to={`/improvements/${imp.id}/present`}
                              className="inline-flex items-center justify-center p-1.5 text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-600 hover:to-orange-600 shadow-sm transition-colors"
                              title={t('improvements.present')}
                              aria-label={t('improvements.present')}
                            >
                              <Presentation size={15} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>
                  {t('common.all')} {filtered.length} &mdash; {t('common.date')} {currentPage}/{totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => {
                      // Show first, last, current, and neighbours
                      return (
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1
                      )
                    })
                    .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push('ellipsis')
                      }
                      acc.push(p)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      item === 'ellipsis' ? (
                        <span key={`e${idx}`} className="px-1">
                          &hellip;
                        </span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item as number)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === item
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item}
                        </button>
                      ),
                    )}

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
