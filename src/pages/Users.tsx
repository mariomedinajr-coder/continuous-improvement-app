import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserPlus, X, CheckCircle, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

// ─── Form state ───────────────────────────────────────────────────────────────

interface UserFormState {
  name: string
  area: string
  role: string
  seniority: string
  employee_number: string
}

const EMPTY_FORM: UserFormState = {
  name: '',
  area: '',
  role: '',
  seniority: '',
  employee_number: '',
}

// ─── Inline form / modal ───────────────────────────────────────────────────────

interface UserFormProps {
  initial?: User | null
  onClose: () => void
  onSaved: (user: User) => void
}

function UserForm({ initial, onClose, onSaved }: UserFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<UserFormState>(
    initial
      ? {
          name: initial.name,
          area: initial.area,
          role: initial.role,
          seniority: initial.seniority,
          employee_number: initial.employee_number,
        }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof UserFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.employee_number.trim()) {
      setError('Name and Employee Number are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: Partial<User> = {
        name: form.name.trim(),
        area: form.area.trim(),
        role: form.role.trim(),
        seniority: form.seniority.trim(),
        employee_number: form.employee_number.trim(),
      }

      if (initial?.id) {
        const { data, error: upsertError } = await supabase
          .from('users')
          .update(payload)
          .eq('id', initial.id)
          .select()
          .single()

        if (upsertError) throw upsertError
        onSaved(data as User)
      } else {
        const { data, error: insertError } = await supabase
          .from('users')
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError
        onSaved(data as User)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const fields: { key: keyof UserFormState; label: string; required?: boolean }[] = [
    { key: 'employee_number', label: t('users.employeeNumber'), required: true },
    { key: 'name', label: t('common.name'), required: true },
    { key: 'area', label: t('common.area') },
    { key: 'role', label: t('users.role') },
    { key: 'seniority', label: t('users.seniority') },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            {initial ? t('users.edit') : t('users.new')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {fields.map(({ key, label, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                required={required}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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

// ─── Main Users Page ───────────────────────────────────────────────────────────

export default function Users() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .order('name', { ascending: true })

        if (fetchError) throw fetchError
        setUsers((data ?? []) as User[])
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
      (u) => u.name.toLowerCase().includes(q) || u.area.toLowerCase().includes(q)
    )
  }, [users, search])

  const handleSaved = (user: User) => {
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
  }

  const handleNewUser = () => {
    setEditUser(null)
    setShowForm(true)
  }

  const handleEditUser = (user: User) => {
    setEditUser(user)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditUser(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('users.title')}</h1>
        <button
          onClick={handleNewUser}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={16} />
          {t('users.new')}
        </button>
      </div>

      {/* Error */}
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
          className="block w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                    {t('users.employeeNumber')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('common.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('common.area')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('users.role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('users.seniority')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('users.totalPoints')}
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
                      savedId === user.id ? 'bg-green-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700 font-mono">{user.employee_number}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {savedId === user.id && (
                          <CheckCircle size={14} className="text-green-500 shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{user.area}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{user.role}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{user.seniority}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-blue-700">{user.total_points ?? 0}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      >
                        <Pencil size={13} />
                        {t('users.edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <UserForm
          initial={editUser}
          onClose={handleCloseForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
