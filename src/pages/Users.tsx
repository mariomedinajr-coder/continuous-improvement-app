import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserPlus, X, CheckCircle, Pencil, Eye, EyeOff, Shield, Copy, History, FileText, Users as UsersIcon, Star, Gift, RefreshCw, TrendingUp, TrendingDown, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { User, UserRole, ImprovementStatus, Team } from '../types'

type UserRow = User & { team: { name: string } | null }

// ─── Form state ───────────────────────────────────────────────────────────────

interface UserFormState {
  name: string
  area: string
  job_title: string
  seniority: string
  employee_number: string
  email: string
  password: string
  role: UserRole
  team_id: string
}

const EMPTY_FORM: UserFormState = {
  name: '',
  area: '',
  job_title: '',
  seniority: '',
  employee_number: '',
  email: '',
  password: '',
  role: 'viewer',
  team_id: '',
}

const ROLE_STYLES: Record<UserRole, string> = {
  admin:   'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  viewer:  'bg-gray-100 text-gray-600',
}

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const sym = '!@#$%&*'
  let out = ''
  for (let i = 0; i < length - 1; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  out += sym[Math.floor(Math.random() * sym.length)]
  return out
}

// ─── Form modal ────────────────────────────────────────────────────────────────

interface UserFormProps {
  initial?: User | null
  onClose: () => void
  onSaved: (user: UserRow, createdPassword?: string) => void
}

function UserForm({ initial, onClose, onSaved }: UserFormProps) {
  const { t } = useTranslation()
  const isEdit = !!initial?.id

  const [form, setForm] = useState<UserFormState>(
    initial
      ? {
          name: initial.name,
          area: initial.area,
          job_title: initial.job_title,
          seniority: initial.seniority,
          employee_number: initial.employee_number,
          email: initial.email ?? '',
          password: '',
          role: initial.role,
          team_id: initial.team_id ?? '',
        }
      : { ...EMPTY_FORM, password: generatePassword() },
  )
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teams, setTeams] = useState<Pick<Team, 'id' | 'name'>[]>([])

  useEffect(() => {
    if (!isEdit) return
    supabase.from('teams').select('id, name').order('name').then(({ data }) => {
      if (data) setTeams(data as Pick<Team, 'id' | 'name'>[])
    })
  }, [isEdit])

  const change = (field: keyof UserFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError(t('users.errors.nameRequired'))
      return
    }
    if (!isEdit && !form.email.trim()) {
      setError(t('users.errors.emailRequired'))
      return
    }
    if (!isEdit && form.password.length < 8) {
      setError(t('users.errors.passwordShort'))
      return
    }

    setSaving(true)
    try {
      if (isEdit) {
        const payload = {
          name: form.name.trim(),
          area: form.area.trim(),
          job_title: form.job_title.trim(),
          seniority: form.seniority.trim(),
          employee_number: form.employee_number.trim(),
          role: form.role,
          team_id: form.team_id || null,
        }
        const { data, error: upErr } = await supabase
          .from('users')
          .update(payload)
          .eq('id', initial!.id)
          .select('*, team:teams(name)')
          .single()
        if (upErr) throw upErr
        onSaved(data as UserRow)
      } else {
        const { data: newId, error: rpcErr } = await supabase.rpc('admin_create_user', {
          p_email: form.email.trim(),
          p_password: form.password,
          p_name: form.name.trim(),
          p_area: form.area.trim(),
          p_job_title: form.job_title.trim(),
          p_seniority: form.seniority.trim(),
          p_employee_number: form.employee_number.trim(),
          p_role: form.role,
        })
        if (rpcErr) throw rpcErr
        const { data: fresh, error: fetchErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', newId as string)
          .single()
        if (fetchErr) throw fetchErr
        onSaved({ ...(fresh as User), team: null }, form.password)
      }
      onClose()
    } catch (err) {
      console.error('Create user error:', err)
      const msg =
        err instanceof Error ? err.message
        : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
        : JSON.stringify(err)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? t('users.edit') : t('users.new')}
          </h3>
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

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => change('name', e.target.value)}
              required
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Email (only on create) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.email')} <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => change('email', e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Temp password (only on create) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.tempPassword')} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => change('password', e.target.value)}
                    required
                    minLength={8}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => change('password', generatePassword())}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  {t('users.regenerate')}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('users.tempPasswordHint')}</p>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('users.systemRole')} <span className="text-red-500">*</span>
            </label>
            <select
              value={form.role}
              onChange={(e) => change('role', e.target.value as UserRole)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="viewer">{t('auth.role.viewer')}</option>
              <option value="manager">{t('auth.role.manager')}</option>
              <option value="admin">{t('auth.role.admin')}</option>
            </select>
          </div>

          {/* Team (edit only) */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.team')}
              </label>
              <select
                value={form.team_id}
                onChange={(e) => change('team_id', e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{t('users.noTeam')}</option>
                {teams.map(tm => (
                  <option key={tm.id} value={tm.id}>{tm.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Optional fields */}
          {([
            ['employee_number', t('users.employeeNumber')],
            ['area', t('common.area')],
            ['job_title', t('users.role')],
            ['seniority', t('users.seniority')],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => change(key, e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}

          {/* Actions */}
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
              disabled={saving}
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

// ─── Credential toast ──────────────────────────────────────────────────────────

function CredentialToast({
  email,
  password,
  onClose,
}: {
  email: string
  password: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = () => {
    const text = `${t('auth.email')}: ${email}\n${t('users.tempPassword')}: ${password}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{t('users.createdTitle')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('users.createdSubtitle')}</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4">
          <div>
            <p className="text-xs uppercase font-bold text-gray-400">{t('auth.email')}</p>
            <p className="font-mono text-sm text-gray-800 break-all">{email}</p>
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-gray-400">{t('users.tempPassword')}</p>
            <p className="font-mono text-sm text-gray-800 break-all">{password}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={copy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <Copy size={14} />
            {copied ? t('users.copied') : t('users.copy')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── User Activity History Modal ──────────────────────────────────────────────

type HistoryEventType = 'submitted' | 'participated' | 'points_received' | 'redeemed' | 'status_changed'

interface HistoryEvent {
  id: string
  type: HistoryEventType
  date: string
  title: string
  subtitle?: string
  meta?: string
  status?: ImprovementStatus
  points?: number
}

const EVENT_STYLES: Record<HistoryEventType, { icon: typeof FileText; bg: string; color: string }> = {
  submitted:       { icon: FileText,  bg: 'bg-blue-50',    color: 'text-blue-700' },
  participated:    { icon: UsersIcon, bg: 'bg-indigo-50',  color: 'text-indigo-700' },
  points_received: { icon: Star,      bg: 'bg-yellow-50',  color: 'text-yellow-700' },
  redeemed:        { icon: Gift,      bg: 'bg-emerald-50', color: 'text-emerald-700' },
  status_changed:  { icon: RefreshCw, bg: 'bg-purple-50',  color: 'text-purple-700' },
}

function UserHistoryModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { t } = useTranslation()
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ earned: 0, spent: 0, submitted: 0, participated: 0 })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      supabase.from('improvements')
        .select('id, title, status, created_at')
        .eq('created_by', user.id),
      supabase.from('improvement_participants')
        .select('id, role_in_project, improvement:improvements(id, title, status, created_at)')
        .eq('user_id', user.id),
      supabase.from('point_assignments')
        .select('id, points, created_at, improvement:improvements(title)')
        .eq('user_id', user.id),
      supabase.from('award_redemptions')
        .select('id, points_spent, status, created_at, award:awards(name)')
        .eq('user_id', user.id),
      supabase.from('status_history')
        .select('id, from_status, to_status, created_at, improvement:improvements(title)')
        .eq('changed_by', user.id),
    ]).then(([subRes, partRes, ptsRes, redRes, hisRes]) => {
      if (cancelled) return

      const collected: HistoryEvent[] = []

      type SubRow = { id: string; title: string; status: ImprovementStatus; created_at: string }
      ;((subRes.data ?? []) as SubRow[]).forEach(s => {
        collected.push({
          id: `sub-${s.id}`,
          type: 'submitted',
          date: s.created_at,
          title: s.title,
          status: s.status,
        })
      })

      // Supabase returns embedded relations as objects when the FK is unique,
      // but the typings sometimes infer arrays. We use `unknown` casts to bridge.
      type Embed<T> = T | T[] | null
      function pick<T>(rel: Embed<T>): T | null {
        if (rel == null) return null
        return Array.isArray(rel) ? (rel[0] ?? null) : rel
      }

      type PartRow = { id: string; role_in_project: string; improvement: Embed<{ id: string; title: string; status: ImprovementStatus; created_at: string }> }
      ;((partRes.data ?? []) as unknown as PartRow[]).forEach(p => {
        const imp = pick(p.improvement)
        if (!imp) return
        collected.push({
          id: `part-${p.id}`,
          type: 'participated',
          date: imp.created_at,
          title: imp.title,
          subtitle: p.role_in_project,
          status: imp.status,
        })
      })

      type PtsRow = { id: string; points: number; created_at: string; improvement: Embed<{ title: string }> }
      let totalEarned = 0
      ;((ptsRes.data ?? []) as unknown as PtsRow[]).forEach(pa => {
        totalEarned += pa.points
        collected.push({
          id: `pts-${pa.id}`,
          type: 'points_received',
          date: pa.created_at,
          title: pick(pa.improvement)?.title ?? '—',
          points: pa.points,
        })
      })

      type RedRow = { id: string; points_spent: number; status: string; created_at: string; award: Embed<{ name: string }> }
      let totalSpent = 0
      ;((redRes.data ?? []) as unknown as RedRow[]).forEach(r => {
        if (r.status !== 'cancelled') totalSpent += r.points_spent
        collected.push({
          id: `red-${r.id}`,
          type: 'redeemed',
          date: r.created_at,
          title: pick(r.award)?.name ?? '—',
          subtitle: t(`redemption.${r.status}`),
          points: -r.points_spent,
        })
      })

      type HisRow = { id: string; from_status: string | null; to_status: string; created_at: string; improvement: Embed<{ title: string }> }
      ;((hisRes.data ?? []) as unknown as HisRow[]).forEach(h => {
        collected.push({
          id: `his-${h.id}`,
          type: 'status_changed',
          date: h.created_at,
          title: pick(h.improvement)?.title ?? '—',
          meta: `${h.from_status ? t(`status.${h.from_status}`) : '—'} → ${t(`status.${h.to_status}`)}`,
        })
      })

      collected.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setEvents(collected)
      setStats({
        earned: totalEarned,
        spent: totalSpent,
        submitted: (subRes.data ?? []).length,
        participated: (partRes.data ?? []).length,
      })
      setLoading(false)
    }).catch(err => {
      if (!cancelled) {
        console.error('History fetch error:', err)
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [user.id, t])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base shrink-0">
              {user.name?.split(' ').map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 truncate">{user.name}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_STYLES[user.role]}`}>
                  {t(`auth.role.${user.role}`)}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{user.area} {user.email ? `· ${user.email}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-600" />
              <p className="text-xs uppercase font-bold text-gray-400">{t('users.history.earned')}</p>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-1">{stats.earned}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-rose-600" />
              <p className="text-xs uppercase font-bold text-gray-400">{t('users.history.spent')}</p>
            </div>
            <p className="text-xl font-bold text-rose-600 mt-1">{stats.spent}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <p className="text-xs uppercase font-bold text-gray-400">{t('users.history.submitted')}</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{stats.submitted}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <p className="text-xs uppercase font-bold text-gray-400">{t('users.history.participated')}</p>
            <p className="text-xl font-bold text-indigo-600 mt-1">{stats.participated}</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin border-4 border-blue-600 border-t-transparent rounded-full w-8 h-8" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12">
              {t('users.history.empty')}
            </div>
          ) : (
            <ol className="relative border-l border-gray-200 ml-4 space-y-4 py-2">
              {events.map(ev => {
                const { icon: Icon, bg, color } = EVENT_STYLES[ev.type]
                return (
                  <li key={ev.id} className="ml-6">
                    <span className={`absolute -left-[14px] flex items-center justify-center w-7 h-7 rounded-full ${bg} ring-4 ring-white`}>
                      <Icon size={13} className={color} />
                    </span>
                    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            {t(`users.history.types.${ev.type}`)}
                          </p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5 break-words">{ev.title}</p>
                          {ev.subtitle && <p className="text-xs text-gray-500 mt-0.5">{ev.subtitle}</p>}
                          {ev.meta && <p className="text-xs text-gray-600 mt-0.5 font-mono">{ev.meta}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ev.points !== undefined && (
                            <span className={`text-sm font-bold ${ev.points >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {ev.points >= 0 ? '+' : ''}{ev.points} pts
                            </span>
                          )}
                          {ev.status && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {t(`status.${ev.status}`)}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(ev.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Users Page ───────────────────────────────────────────────────────────

export default function Users() {
  const { t } = useTranslation()
  const { isAdmin, profile } = useAuth()

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [historyUser, setHistoryUser] = useState<User | null>(null)

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*, team:teams(name)')
          .order('name', { ascending: true })

        if (fetchError) throw fetchError
        setUsers((data ?? []) as UserRow[])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.trim().toLowerCase()
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.area.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    )
  }, [users, search])

  const handleSaved = (user: UserRow, createdPassword?: string) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = user
        return next
      }
      return [...prev, user].sort((a, b) => a.name.localeCompare(b.name))
    })
    setSavedId(user.id)
    setTimeout(() => setSavedId(null), 2500)
    if (createdPassword && user.email) {
      setCredentials({ email: user.email, password: createdPassword })
    }
  }

  async function changeRole(user: User, role: UserRole) {
    if (user.role === role) return
    if (user.id === profile?.id && role !== 'admin') {
      if (!confirm(t('users.confirmDemoteSelf'))) return
    }
    setSavingId(user.id)
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', user.id)
      .select('*, team:teams(name)')
      .single()
    setSavingId(null)
    if (error) {
      alert(error.message)
      return
    }
    setUsers(prev => prev.map(u => (u.id === user.id ? (data as UserRow) : u)))
  }

  async function toggleActive(user: User) {
    if (user.id === profile?.id) {
      alert(t('users.cannotDeactivateSelf'))
      return
    }
    setSavingId(user.id)
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)
      .select('*, team:teams(name)')
      .single()
    setSavingId(null)
    if (error) {
      alert(error.message)
      return
    }
    setUsers(prev => prev.map(u => (u.id === user.id ? (data as UserRow) : u)))
  }

  async function deleteUser(user: User) {
    if (user.id === profile?.id) {
      alert(t('users.cannotDeleteSelf'))
      return
    }
    if (!confirm(t('users.confirmDelete', { name: user.name }))) return
    setSavingId(user.id)
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: user.id })
    setSavingId(null)
    if (error) {
      alert(error.message)
      return
    }
    setUsers(prev => prev.filter(u => u.id !== user.id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('users.title')}</h1>
        {isAdmin && (
          <button
            onClick={() => { setEditUser(null); setShowForm(true) }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
          >
            <UserPlus size={16} />
            {t('users.new')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {error}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="block w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            {t('common.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            {t('users.noUsers')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('common.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('auth.email')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('users.systemRole')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('common.area')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('users.team')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('users.role')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('users.totalPoints')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('users.status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className={`transition-colors ${
                      savedId === user.id ? 'bg-green-50' :
                      !user.is_active ? 'bg-gray-50/50 opacity-60' :
                      'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {savedId === user.id && <CheckCircle size={14} className="text-green-500 shrink-0" />}
                        <span className="text-sm font-semibold text-gray-900">{user.name}</span>
                        {user.id === profile?.id && (
                          <span className="text-xs text-blue-600 font-medium">({t('users.you')})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isAdmin ? (
                        <select
                          value={user.role}
                          onChange={(e) => changeRole(user, e.target.value as UserRole)}
                          disabled={savingId === user.id}
                          className={`text-xs font-medium rounded-full px-2.5 py-1 pr-7 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${ROLE_STYLES[user.role]} disabled:opacity-50`}
                        >
                          <option value="viewer" className="bg-white text-gray-800">{t('auth.role.viewer')}</option>
                          <option value="manager" className="bg-white text-gray-800">{t('auth.role.manager')}</option>
                          <option value="admin" className="bg-white text-gray-800">{t('auth.role.admin')}</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[user.role]}`}>
                          {user.role === 'admin' && <Shield size={11} />}
                          {t(`auth.role.${user.role}`)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.area}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.team?.name ?? '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.job_title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-blue-700">
                      {user.total_points ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {isAdmin ? (
                        <button
                          onClick={() => toggleActive(user)}
                          disabled={savingId === user.id || user.id === profile?.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            user.is_active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {user.is_active ? t('users.active') : t('users.inactive')}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {user.is_active ? t('users.active') : t('users.inactive')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setHistoryUser(user)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                        >
                          <History size={13} />
                          {t('users.history.button')}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => { setEditUser(user); setShowForm(true) }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                          >
                            <Pencil size={13} />
                            {t('users.edit')}
                          </button>
                        )}
                        {isAdmin && user.id !== profile?.id && (
                          <button
                            onClick={() => deleteUser(user)}
                            disabled={savingId === user.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 size={13} />
                            {t('common.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <UserForm
          initial={editUser}
          onClose={() => { setShowForm(false); setEditUser(null) }}
          onSaved={handleSaved}
        />
      )}

      {credentials && (
        <CredentialToast
          email={credentials.email}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}

      {historyUser && (
        <UserHistoryModal user={historyUser} onClose={() => setHistoryUser(null)} />
      )}
    </div>
  )
}
