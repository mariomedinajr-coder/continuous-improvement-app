import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Pencil, Trash2, UsersRound, UserPlus, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Team } from '../types'

interface TeamRow extends Team {
  members_count: number
}

interface MemberRow {
  id: string
  name: string
  job_title: string
  area: string
  total_points: number
}

interface TeamFormState {
  name: string
  area: string
}

interface TeamFormProps {
  initial?: Team | null
  onClose: () => void
  onSaved: (team: Team) => void
}

function TeamForm({ initial, onClose, onSaved }: TeamFormProps) {
  const { t } = useTranslation()
  const isEdit = !!initial?.id

  const [form, setForm] = useState<TeamFormState>({
    name: initial?.name ?? '',
    area: initial?.area ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const change = (field: keyof TeamFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError(t('teams.errors.nameRequired'))
      return
    }

    setSaving(true)
    const payload = { name: form.name.trim(), area: form.area.trim() }

    if (isEdit) {
      const { data, error: upErr } = await supabase
        .from('teams')
        .update(payload)
        .eq('id', initial!.id)
        .select()
        .single()
      setSaving(false)
      if (upErr) { setError(upErr.message); return }
      onSaved(data as Team)
    } else {
      const { data, error: insErr } = await supabase
        .from('teams')
        .insert(payload)
        .select()
        .single()
      setSaving(false)
      if (insErr) { setError(insErr.message); return }
      onSaved(data as Team)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? t('teams.edit') : t('teams.new')}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('teams.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => change('name', e.target.value)}
              required
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.area')}
            </label>
            <input
              type="text"
              value={form.area}
              onChange={(e) => change('area', e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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

interface MembersModalProps {
  team: TeamRow
  onClose: () => void
  onCountChange: (teamId: string, delta: number) => void
}

const EMPTY_MEMBER = { name: '', area: '', job_title: '', employee_number: '' }

function TeamMembersModal({ team, onClose, onCountChange }: MembersModalProps) {
  const { t } = useTranslation()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_MEMBER)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('users')
      .select('id, name, job_title, area, total_points')
      .eq('team_id', team.id)
      .order('name', { ascending: true })
      .then(({ data }) => {
        setMembers((data ?? []) as MemberRow[])
        setLoading(false)
      })
  }, [team.id])

  const change = (field: keyof typeof EMPTY_MEMBER, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError(t('teams.errors.memberNameRequired'))
      return
    }
    setAdding(true)
    // Login-less collaborator: no email / auth_id, role viewer, attached to this team.
    const { data, error: insErr } = await supabase
      .from('users')
      .insert({
        name: form.name.trim(),
        area: form.area.trim(),
        job_title: form.job_title.trim(),
        employee_number: form.employee_number.trim(),
        role: 'viewer',
        is_active: true,
        team_id: team.id,
      })
      .select('id, name, job_title, area, total_points')
      .single()
    setAdding(false)
    if (insErr) { setError(insErr.message); return }
    setMembers(prev => [...prev, data as MemberRow].sort((a, b) => a.name.localeCompare(b.name)))
    onCountChange(team.id, 1)
    setForm(EMPTY_MEMBER)
  }

  async function handleRemove(m: MemberRow) {
    if (!confirm(t('teams.removeMemberConfirm'))) return
    setRemovingId(m.id)
    const { error: upErr } = await supabase.from('users').update({ team_id: null }).eq('id', m.id)
    setRemovingId(null)
    if (upErr) { alert(upErr.message); return }
    setMembers(prev => prev.filter(x => x.id !== m.id))
    onCountChange(team.id, -1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            {t('teams.membersOf', { name: team.name })}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {/* Member list */}
          {loading ? (
            <p className="text-sm text-gray-500 py-4">{t('common.loading')}</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">{t('teams.noMembers')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-400">
                        {[m.job_title, m.area].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-yellow-600">
                      <Star size={13} fill="currentColor" />{m.total_points}
                    </span>
                    <button
                      onClick={() => handleRemove(m)}
                      disabled={removingId === m.id}
                      title={t('teams.remove')}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add collaborator */}
        <form onSubmit={handleAdd} className="border-t border-gray-100 px-6 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus size={15} className="text-blue-600" />
            <p className="text-sm font-semibold text-gray-800">{t('teams.addMemberTitle')}</p>
          </div>
          <p className="text-xs text-gray-400">{t('teams.loginlessHint')}</p>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <input
            type="text"
            value={form.name}
            onChange={e => change('name', e.target.value)}
            placeholder={t('common.name')}
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={form.job_title}
              onChange={e => change('job_title', e.target.value)}
              placeholder={t('users.role')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={form.area}
              onChange={e => change('area', e.target.value)}
              placeholder={t('common.area')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={form.employee_number}
              onChange={e => change('employee_number', e.target.value)}
              placeholder={t('users.employeeNumber')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <UserPlus size={15} />
              {adding ? t('common.loading') : t('teams.addMember')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Teams() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()

  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [manageTeam, setManageTeam] = useState<TeamRow | null>(null)

  const handleCountChange = (teamId: string, delta: number) =>
    setTeams(prev => prev.map(tm =>
      tm.id === teamId ? { ...tm, members_count: Math.max(0, tm.members_count + delta) } : tm
    ))

  useEffect(() => {
    async function fetchTeams() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*, members:users(count)')
        .order('name', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      type Raw = Team & { members: { count: number }[] }
      const rows = ((data ?? []) as Raw[]).map(r => ({
        id: r.id,
        name: r.name,
        area: r.area,
        created_at: r.created_at,
        members_count: r.members[0]?.count ?? 0,
      }))
      setTeams(rows)
      setLoading(false)
    }
    fetchTeams()
  }, [])

  const handleSaved = (team: Team) => {
    setTeams(prev => {
      const idx = prev.findIndex(tm => tm.id === team.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], name: team.name, area: team.area }
        return next
      }
      return [...prev, { ...team, members_count: 0 }].sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  async function handleDelete(team: TeamRow) {
    if (!confirm(t('teams.deleteConfirm'))) return
    setDeletingId(team.id)
    const { error: delErr } = await supabase.from('teams').delete().eq('id', team.id)
    setDeletingId(null)
    if (delErr) {
      alert(delErr.message)
      return
    }
    setTeams(prev => prev.filter(tm => tm.id !== team.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('teams.title')}</h1>
        {isAdmin && (
          <button
            onClick={() => { setEditTeam(null); setShowForm(true) }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            {t('teams.new')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            {t('common.loading')}
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-gray-400 gap-2">
            <UsersRound size={28} className="text-gray-300" />
            {t('teams.noTeams')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('teams.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('common.area')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('teams.members')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teams.map((team) => (
                  <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {team.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {team.area || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-blue-700">
                      {team.members_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setManageTeam(team)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            <UsersRound size={13} />
                            {t('teams.manageMembers')}
                          </button>
                          <button
                            onClick={() => { setEditTeam(team); setShowForm(true) }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                          >
                            <Pencil size={13} />
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => handleDelete(team)}
                            disabled={deletingId === team.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 size={13} />
                            {t('common.delete')}
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
      </div>

      {showForm && (
        <TeamForm
          initial={editTeam}
          onClose={() => { setShowForm(false); setEditTeam(null) }}
          onSaved={handleSaved}
        />
      )}

      {manageTeam && (
        <TeamMembersModal
          team={manageTeam}
          onClose={() => setManageTeam(null)}
          onCountChange={handleCountChange}
        />
      )}
    </div>
  )
}
