import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, X, Pencil, Trash2, Upload, Gift, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {
  SQDCMCategory,
  SQDCMPointConfig,
  ImprovementParticipant,
  Improvement,
  SQDCMImpact,
  ImprovementStatus,
  Award,
  AwardRedemption,
  RedemptionStatus,
  User,
} from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: SQDCMCategory[] = ['S', 'Q', 'D', 'C', 'M']

const CATEGORY_LABELS: Record<SQDCMCategory, string> = {
  S: 'Safety / Seguridad',
  Q: 'Quality / Calidad',
  D: 'Delivery / Entrega',
  C: 'Cost / Costo',
  M: 'Morale / Moral',
}

const STATUS_OPTIONS: ImprovementStatus[] = [
  'submitted',
  'under_review',
  'approved',
  'implemented',
  'rejected',
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface PointConfigRow {
  high: number
  medium: number
}

interface PendingImprovement extends Improvement {
  // sqdcm_impact already parsed via JSON in DB jsonb column
}

interface ParticipantCheck extends ImprovementParticipant {
  selected: boolean
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Tab 1: Point Configuration ───────────────────────────────────────────────

function PointConfigTab() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<Record<SQDCMCategory, PointConfigRow>>(
    () =>
      Object.fromEntries(CATEGORIES.map((c) => [c, { high: 10, medium: 5 }])) as Record<
        SQDCMCategory,
        PointConfigRow
      >
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadConfig() {
      setLoading(true)
      try {
        const { data, error: fetchError } = await supabase
          .from('sqdcm_point_config')
          .select('*')

        if (fetchError) throw fetchError

        if (data && data.length > 0) {
          const updated = { ...config }
          for (const row of data as SQDCMPointConfig[]) {
            if (CATEGORIES.includes(row.category)) {
              if (row.impact_level === 'high') {
                updated[row.category] = { ...updated[row.category], high: row.points }
              } else if (row.impact_level === 'medium') {
                updated[row.category] = { ...updated[row.category], medium: row.points }
              }
            }
          }
          setConfig(updated)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (category: SQDCMCategory, level: 'high' | 'medium', value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0)
    setConfig((prev) => ({
      ...prev,
      [category]: { ...prev[category], [level]: num },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const rows: Omit<SQDCMPointConfig, 'id'>[] = []
      for (const category of CATEGORIES) {
        rows.push({ category, impact_level: 'high', points: config[category].high })
        rows.push({ category, impact_level: 'medium', points: config[category].medium })
      }

      const { error: upsertError } = await supabase
        .from('sqdcm_point_config')
        .upsert(rows, { onConflict: 'category,impact_level' })

      if (upsertError) throw upsertError
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{t('admin.pointConfigSubtitle')}</p>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle size={16} />
          {t('common.success')}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('admin.category')}
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('admin.highImpact')}
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('admin.mediumImpact')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {CATEGORIES.map((cat) => (
              <tr key={cat} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-xs font-bold">
                      {cat}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {CATEGORY_LABELS[cat]}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="number"
                    min={0}
                    value={config[cat].high}
                    onChange={(e) => handleChange(cat, 'high', e.target.value)}
                    className="w-24 mx-auto block rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-center text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="number"
                    min={0}
                    value={config[cat].medium}
                    onChange={(e) => handleChange(cat, 'medium', e.target.value)}
                    className="w-24 mx-auto block rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-center text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? t('common.loading') : t('admin.saveConfig')}
        </button>
      </div>
    </div>
  )
}

// ─── Assign Points Modal ───────────────────────────────────────────────────────

interface AssignModalProps {
  improvement: PendingImprovement
  pointConfig: Record<SQDCMCategory, PointConfigRow>
  onClose: () => void
  onAssigned: () => void
}

function AssignModal({ improvement, pointConfig, onClose, onAssigned }: AssignModalProps) {
  const { t } = useTranslation()
  const [participants, setParticipants] = useState<ParticipantCheck[]>([])
  const [loadingPart, setLoadingPart] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Parse sqdcm_impact safely
  const impacts: SQDCMImpact[] = Array.isArray(improvement.sqdcm_impact)
    ? improvement.sqdcm_impact
    : []

  // Calculate total points from high/medium impacts
  const calculatedPoints = impacts.reduce((sum, item) => {
    if (item.impact_level === 'high') return sum + (pointConfig[item.category]?.high ?? 0)
    if (item.impact_level === 'medium') return sum + (pointConfig[item.category]?.medium ?? 0)
    return sum
  }, 0)

  useEffect(() => {
    async function loadParticipants() {
      setLoadingPart(true)
      try {
        const { data, error: fetchError } = await supabase
          .from('improvement_participants')
          .select('*, user:users(id, name, area)')
          .eq('improvement_id', improvement.id)

        if (fetchError) throw fetchError
        setParticipants(
          ((data ?? []) as ImprovementParticipant[]).map((p) => ({ ...p, selected: true }))
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoadingPart(false)
      }
    }
    loadParticipants()
  }, [improvement.id])

  const toggleParticipant = (id: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    )
  }

  const handleConfirm = async () => {
    setAssigning(true)
    setError(null)
    try {
      const selected = participants.filter((p) => p.selected)
      if (selected.length === 0) {
        setError('Select at least one participant.')
        setAssigning(false)
        return
      }

      const inserts = selected.map((p) => ({
        improvement_id: improvement.id,
        user_id: p.user_id,
        points: calculatedPoints,
        assigned_by: 'admin',
      }))

      const { error: insertError } = await supabase.from('point_assignments').insert(inserts)
      if (insertError) throw insertError

      onAssigned()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{t('admin.assignPoints')}</h3>
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{improvement.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* SQDCM Impacts */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              SQDCM Impact
            </h4>
            {impacts.length === 0 ? (
              <p className="text-sm text-gray-400">{t('common.none')}</p>
            ) : (
              <div className="space-y-1.5">
                {impacts
                  .filter((i) => i.impact_level !== 'none')
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-600 text-white text-xs font-bold">
                          {item.category}
                        </span>
                        <span className="text-sm text-gray-700 line-clamp-1">{item.description}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            item.impact_level === 'high'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {t(`sqdcm.impact.${item.impact_level}`)}
                        </span>
                        <span className="text-sm font-semibold text-blue-700 w-12 text-right">
                          +
                          {item.impact_level === 'high'
                            ? pointConfig[item.category]?.high ?? 0
                            : item.impact_level === 'medium'
                            ? pointConfig[item.category]?.medium ?? 0
                            : 0}{' '}
                          pts
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Calculated total */}
          <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
            <span className="text-sm font-medium text-blue-800">{t('admin.calculatedPoints')}</span>
            <span className="text-xl font-bold text-blue-700">{calculatedPoints} pts</span>
          </div>

          {/* Participants */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('admin.participants')}
            </h4>
            {loadingPart ? (
              <p className="text-sm text-gray-400">{t('common.loading')}</p>
            ) : participants.length === 0 ? (
              <p className="text-sm text-gray-400">{t('common.none')}</p>
            ) : (
              <div className="space-y-1.5">
                {participants.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={p.selected}
                      onChange={() => toggleParticipant(p.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{p.user?.name ?? p.user_id}</p>
                      {p.user?.area && (
                        <p className="text-xs text-gray-500">{p.user.area}</p>
                      )}
                    </div>
                    {p.role_in_project && (
                      <span className="text-xs text-gray-400">{p.role_in_project}</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={assigning || loadingPart}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {assigning ? t('common.loading') : t('admin.confirmAssign')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: Assign Points ──────────────────────────────────────────────────────

function AssignPointsTab() {
  const { t } = useTranslation()
  const [improvements, setImprovements] = useState<PendingImprovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pointConfig, setPointConfig] = useState<Record<SQDCMCategory, PointConfigRow>>(
    () =>
      Object.fromEntries(CATEGORIES.map((c) => [c, { high: 10, medium: 5 }])) as Record<
        SQDCMCategory,
        PointConfigRow
      >
  )
  const [selectedImprovement, setSelectedImprovement] = useState<PendingImprovement | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Load point config
      const { data: configData } = await supabase.from('sqdcm_point_config').select('*')
      if (configData && configData.length > 0) {
        const updated = Object.fromEntries(
          CATEGORIES.map((c) => [c, { high: 10, medium: 5 }])
        ) as Record<SQDCMCategory, PointConfigRow>
        for (const row of configData as SQDCMPointConfig[]) {
          if (CATEGORIES.includes(row.category)) {
            if (row.impact_level === 'high') updated[row.category].high = row.points
            else if (row.impact_level === 'medium') updated[row.category].medium = row.points
          }
        }
        setPointConfig(updated)
      }

      // Load improvements that are approved/implemented but don't have point_assignments yet
      const { data: improvData, error: improvError } = await supabase
        .from('improvements')
        .select('*')
        .in('status', ['approved', 'implemented'])

      if (improvError) throw improvError

      const allImprovements = (improvData ?? []) as PendingImprovement[]

      // Filter out those that already have assignments
      const ids = allImprovements.map((i) => i.id)
      if (ids.length === 0) {
        setImprovements([])
        setLoading(false)
        return
      }

      const { data: assignedData } = await supabase
        .from('point_assignments')
        .select('improvement_id')
        .in('improvement_id', ids)

      const assignedIds = new Set((assignedData ?? []).map((r: { improvement_id: string }) => r.improvement_id))

      setImprovements(allImprovements.filter((i) => !assignedIds.has(i.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAssigned = () => {
    setSuccessMsg(t('admin.pointsAssigned'))
    setTimeout(() => setSuccessMsg(null), 3000)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {error}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {improvements.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
          {t('common.none')}
        </div>
      ) : (
        <div className="space-y-3">
          {improvements.map((imp) => {
            const impacts: SQDCMImpact[] = Array.isArray(imp.sqdcm_impact) ? imp.sqdcm_impact : []
            const activeImpacts = impacts.filter((i) => i.impact_level !== 'none')

            return (
              <div
                key={imp.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{imp.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{imp.area}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {activeImpacts.map((item, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          item.impact_level === 'high'
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                        }`}
                      >
                        <span className="font-bold">{item.category}</span>
                        {' — '}
                        {t(`sqdcm.impact.${item.impact_level}`)}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedImprovement(imp)}
                  className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
                >
                  {t('common.assign')}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {selectedImprovement && (
        <AssignModal
          improvement={selectedImprovement}
          pointConfig={pointConfig}
          onClose={() => setSelectedImprovement(null)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  )
}

// ─── Tab 3: Update Status ──────────────────────────────────────────────────────

interface StatusRow {
  id: string
  title: string
  status: ImprovementStatus
  newStatus: ImprovementStatus
}

function UpdateStatusTab() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<StatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadImprovements() {
      setLoading(true)
      try {
        const { data, error: fetchError } = await supabase
          .from('improvements')
          .select('id, title, status')
          .in('status', ['submitted', 'under_review'])
          .order('updated_at', { ascending: false })

        if (fetchError) throw fetchError

        setRows(
          ((data ?? []) as Pick<Improvement, 'id' | 'title' | 'status'>[]).map((r) => ({
            ...r,
            newStatus: r.status,
          }))
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    loadImprovements()
  }, [])

  const handleStatusChange = (id: string, status: ImprovementStatus) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, newStatus: status } : r)))
  }

  const handleSave = async (row: StatusRow) => {
    setSaving(row.id)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('improvements')
        .update({ status: row.newStatus })
        .eq('id', row.id)

      if (updateError) throw updateError

      setSavedIds((prev) => new Set(prev).add(row.id))
      setTimeout(() => setSavedIds((prev) => { const next = new Set(prev); next.delete(row.id); return next }), 2500)

      // If newly moved out of submitted/under_review, remove from list
      if (row.newStatus !== 'submitted' && row.newStatus !== 'under_review') {
        setRows((prev) => prev.filter((r) => r.id !== row.id))
      } else {
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: row.newStatus } : r))
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
          {t('common.none')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('admin.improvement')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('common.status')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900 max-w-xs truncate">{row.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t(`status.${row.status}`)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={row.newStatus}
                      onChange={(e) => handleStatusChange(row.id, e.target.value as ImprovementStatus)}
                      className="block w-44 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {t(`status.${s}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {savedIds.has(row.id) && (
                        <CheckCircle size={16} className="text-green-500" />
                      )}
                      <button
                        onClick={() => handleSave(row)}
                        disabled={saving === row.id || row.newStatus === row.status}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving === row.id ? t('common.loading') : t('common.save')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Award Form Modal ──────────────────────────────────────────────────────────

interface AwardFormState {
  name: string
  description: string
  point_cost: string
  image_url: string
  stock: string
  active: boolean
}

const EMPTY_AWARD_FORM: AwardFormState = {
  name: '',
  description: '',
  point_cost: '',
  image_url: '',
  stock: '',
  active: true,
}

function AwardFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Award | null
  onClose: () => void
  onSaved: (award: Award) => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AwardFormState>(
    initial
      ? {
          name: initial.name,
          description: initial.description,
          point_cost: String(initial.point_cost),
          image_url: initial.image_url,
          stock: initial.stock === null ? '' : String(initial.stock),
          active: initial.active,
        }
      : EMPTY_AWARD_FORM
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    const path = `${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('awards').upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
    } else {
      const { data } = supabase.storage.from('awards').getPublicUrl(path)
      setForm((prev) => ({ ...prev, image_url: data.publicUrl }))
    }
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cost = parseInt(form.point_cost, 10)
    if (!form.name.trim() || !cost || cost <= 0) {
      setError(t('common.required') as string)
      return
    }
    const stockValue = form.stock.trim() === '' ? null : parseInt(form.stock, 10)
    if (stockValue !== null && (Number.isNaN(stockValue) || stockValue < 0)) {
      setError(t('common.required') as string)
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      point_cost: cost,
      image_url: form.image_url,
      stock: stockValue,
      active: form.active,
    }

    if (initial?.id) {
      const { data, error: updateError } = await supabase
        .from('awards')
        .update(payload)
        .eq('id', initial.id)
        .select()
        .single()
      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }
      onSaved(data as Award)
    } else {
      const { data, error: insertError } = await supabase
        .from('awards')
        .insert(payload)
        .select()
        .single()
      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }
      onSaved(data as Award)
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            {initial ? t('admin.editAward') : t('admin.newAward')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.awardName')}<span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.awardDescription')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.awardCost')}<span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={form.point_cost}
                onChange={(e) => setForm((p) => ({ ...p, point_cost: e.target.value }))}
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.awardStock')}
              </label>
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                placeholder="∞"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.awardImage')}
            </label>
            <div className="flex items-start gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                <Upload size={14} />
                {uploading ? t('common.loading') : t('common.add')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file)
                  }}
                />
              </label>
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                />
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{t('admin.awardActive')}</span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tab 4: Awards Management ─────────────────────────────────────────────────

function AwardsTab() {
  const { t } = useTranslation()
  const [awards, setAwards] = useState<Award[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editAward, setEditAward] = useState<Award | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('awards')
      .select('*')
      .order('created_at', { ascending: false })
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setAwards((data ?? []) as Award[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const handleSaved = (award: Award) => {
    setAwards((prev) => {
      const idx = prev.findIndex((a) => a.id === award.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = award
        return next
      }
      return [award, ...prev]
    })
  }

  const handleDelete = async (award: Award) => {
    if (!confirm(t('admin.deleteAwardConfirm') as string)) return
    const { error: deleteError } = await supabase.from('awards').delete().eq('id', award.id)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      setAwards((prev) => prev.filter((a) => a.id !== award.id))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => { setEditAward(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          {t('admin.newAward')}
        </button>
      </div>

      {awards.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
          {t('awards.noAwards')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('admin.awardName')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('admin.awardCost')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('awards.stock')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('admin.awardActive')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {awards.map((award) => (
                <tr key={award.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {award.image_url ? (
                          <img src={award.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Gift size={16} className="text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{award.name}</p>
                        {award.description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{award.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-blue-700">
                    {award.point_cost}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600">
                    {award.stock === null ? t('awards.unlimited') : award.stock}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {award.active ? (
                      <CheckCircle size={16} className="text-green-500 inline" />
                    ) : (
                      <span className="text-xs text-gray-400">{t('awards.inactive')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditAward(award); setShowForm(true) }}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(award)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <AwardFormModal
          initial={editAward}
          onClose={() => { setShowForm(false); setEditAward(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ─── Redemption Form Modal ─────────────────────────────────────────────────────

function RedemptionFormModal({
  users,
  awards,
  onClose,
  onSaved,
}: {
  users: User[]
  awards: Award[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [userId, setUserId] = useState('')
  const [awardId, setAwardId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedUser = users.find((u) => u.id === userId)
  const selectedAward = awards.find((a) => a.id === awardId)
  const insufficient =
    selectedUser && selectedAward && selectedUser.total_points < selectedAward.point_cost
  const outOfStock = selectedAward && selectedAward.stock !== null && selectedAward.stock <= 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !selectedAward) return
    if (insufficient || outOfStock) return

    setSaving(true)
    setError(null)
    const { error: insertError } = await supabase.from('award_redemptions').insert({
      award_id: selectedAward.id,
      user_id: selectedUser.id,
      points_spent: selectedAward.point_cost,
      status: 'pending',
      notes: notes.trim(),
    })
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{t('admin.newRedemption')}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.selectUser')}<span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.total_points} {t('common.points').toLowerCase()})
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm">
              <span className="text-blue-800">{t('admin.userBalance')}</span>
              <span className="font-bold text-blue-700">
                {selectedUser.total_points} {t('common.points').toLowerCase()}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.selectAward')}<span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={awardId}
              onChange={(e) => setAwardId(e.target.value)}
              required
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">—</option>
              {awards.map((a) => (
                <option key={a.id} value={a.id} disabled={!a.active}>
                  {a.name} — {a.point_cost} {t('common.points').toLowerCase()}
                  {a.stock !== null && ` (${a.stock})`}
                </option>
              ))}
            </select>
          </div>

          {insufficient && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
              {t('admin.notEnoughPoints')}
            </div>
          )}
          {outOfStock && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
              {t('admin.outOfStockShort')}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !selectedUser || !selectedAward || !!insufficient || !!outOfStock}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tab 5: Redemptions ───────────────────────────────────────────────────────

function RedemptionsTab() {
  const { t } = useTranslation()
  const [redemptions, setRedemptions] = useState<AwardRedemption[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [awards, setAwards] = useState<Award[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<RedemptionStatus | 'all'>('all')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [{ data: redData, error: redErr }, { data: userData }, { data: awardData }] =
      await Promise.all([
        supabase
          .from('award_redemptions')
          .select('*, award:awards(name,image_url), user:users(name,area,total_points,spent_points)')
          .order('created_at', { ascending: false }),
        supabase.from('users').select('*').order('name', { ascending: true }),
        supabase.from('awards').select('*').order('name', { ascending: true }),
      ])
    if (redErr) {
      setError(redErr.message)
    } else {
      setRedemptions((redData ?? []) as AwardRedemption[])
    }
    setUsers((userData ?? []) as User[])
    setAwards((awardData ?? []) as Award[])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const handleStatusChange = async (red: AwardRedemption, status: RedemptionStatus) => {
    const patch: { status: RedemptionStatus; fulfilled_at?: string } = { status }
    if (status === 'fulfilled') patch.fulfilled_at = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('award_redemptions')
      .update(patch)
      .eq('id', red.id)
    if (updateError) {
      setError(updateError.message)
    } else {
      load()
    }
  }

  const handleSaved = () => {
    setSavedMsg(t('admin.redemptionRecorded') as string)
    setTimeout(() => setSavedMsg(null), 2500)
    load()
  }

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return redemptions
    return redemptions.filter((r) => r.status === statusFilter)
  }, [redemptions, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {error}
        </div>
      )}
      {savedMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle size={16} />
          {savedMsg}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'fulfilled', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'all' ? t('common.all') : t(`redemption.${s}`)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          {t('admin.newRedemption')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
          {t('admin.noRedemptions')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('common.date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('common.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('admin.awardName')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('common.points')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('common.status')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{r.user?.name ?? r.user_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{r.award?.name ?? r.award_id}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-blue-700">
                    {r.points_spent}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : r.status === 'fulfilled'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {t(`redemption.${r.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {r.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleStatusChange(r, 'fulfilled')}
                          className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                        >
                          {t('admin.markFulfilled')}
                        </button>
                        <button
                          onClick={() => handleStatusChange(r, 'cancelled')}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          {t('admin.cancelRedemption')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <RedemptionFormModal
          users={users}
          awards={awards.filter((a) => a.active)}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────

type AdminTab = 'config' | 'assign' | 'status' | 'awards' | 'redemptions'

export default function Admin() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<AdminTab>('config')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <TabButton active={activeTab === 'config'} onClick={() => setActiveTab('config')}>
          {t('admin.pointConfig')}
        </TabButton>
        <TabButton active={activeTab === 'assign'} onClick={() => setActiveTab('assign')}>
          {t('admin.assignPoints')}
        </TabButton>
        <TabButton active={activeTab === 'status'} onClick={() => setActiveTab('status')}>
          {t('admin.updateStatus')}
        </TabButton>
        <TabButton active={activeTab === 'awards'} onClick={() => setActiveTab('awards')}>
          {t('admin.awardsSection')}
        </TabButton>
        <TabButton active={activeTab === 'redemptions'} onClick={() => setActiveTab('redemptions')}>
          {t('admin.redemptionsSection')}
        </TabButton>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'config' && <PointConfigTab />}
        {activeTab === 'assign' && <AssignPointsTab />}
        {activeTab === 'status' && <UpdateStatusTab />}
        {activeTab === 'awards' && <AwardsTab />}
        {activeTab === 'redemptions' && <RedemptionsTab />}
      </div>
    </div>
  )
}
