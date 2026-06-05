import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronLeft, Check, Upload, X, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { User, SQDCMCategory, ImpactLevel, FiveWhy, IshikawaCause, Solution, ResultIndicator, SQDCMImpact } from '../types'

const SQDCM_CATEGORIES: SQDCMCategory[] = ['S', 'Q', 'D', 'C', 'M']
const ISHIKAWA_BRANCHES = ['method', 'machine', 'manpower', 'material', 'environment', 'measurement']
const TOTAL_STEPS = 11

interface FormData {
  title: string
  area: string
  date_submitted: string
  problem_description: string
  sqdcm_targeted: SQDCMCategory[]
  expected_objective: string
  problem_impact: string
  current_state: string[]
  desired_state: string[]
  participant_ids: string[]
  participant_roles: Record<string, string>
  root_cause_method: '5whys' | 'ishikawa'
  five_whys: FiveWhy[]
  ishikawa_causes: IshikawaCause[]
  solutions: Solution[]
  chosen_solution: string
  dev_planning: string
  dev_resources: string
  dev_implementation: string
  dev_followup: string
  before_images: string[]
  after_images: string[]
  result_indicators: ResultIndicator[]
  new_standards: string[]
  sqdcm_impact: SQDCMImpact[]
  pdca_plan: string
  pdca_do: string
  pdca_check: string
  pdca_act: string
  next_steps_responsible: string
  next_steps_date: string
  next_steps_followup: string
}

const defaultForm = (): FormData => ({
  title: '',
  area: '',
  date_submitted: new Date().toISOString().slice(0, 10),
  problem_description: '',
  sqdcm_targeted: [],
  expected_objective: '',
  problem_impact: '',
  current_state: ['', '', ''],
  desired_state: ['', '', ''],
  participant_ids: [],
  participant_roles: {},
  root_cause_method: '5whys',
  five_whys: Array.from({ length: 5 }, (_, i) => ({ question: `¿Por qué ${i + 1}?`, answer: '' })),
  ishikawa_causes: ISHIKAWA_BRANCHES.map(b => ({ branch: b, cause: '' })),
  solutions: [
    { label: 'A', description: '', impact: 0, ease: 0, cost: 0, risk: 0 },
    { label: 'B', description: '', impact: 0, ease: 0, cost: 0, risk: 0 },
    { label: 'C', description: '', impact: 0, ease: 0, cost: 0, risk: 0 },
  ],
  chosen_solution: '',
  dev_planning: '',
  dev_resources: '',
  dev_implementation: '',
  dev_followup: '',
  before_images: [],
  after_images: [],
  result_indicators: [{ name: '', before: '', after: '', improvement: '' }],
  new_standards: [''],
  sqdcm_impact: SQDCM_CATEGORIES.map(c => ({ category: c, description: '', impact_level: 'none' as ImpactLevel })),
  pdca_plan: '',
  pdca_do: '',
  pdca_check: '',
  pdca_act: '',
  next_steps_responsible: '',
  next_steps_date: '',
  next_steps_followup: '',
})

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < current ? 'bg-blue-600' : i === current ? 'bg-blue-400 w-6' : 'bg-gray-200'
          } ${i === current ? 'w-6' : 'w-3'}`}
        />
      ))}
    </div>
  )
}

function TextArea({ label, value, onChange, hint, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function TextInput({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

export default function ImprovementForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(defaultForm())
  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingBefore, setUploadingBefore] = useState(false)
  const [uploadingAfter, setUploadingAfter] = useState(false)

  useEffect(() => {
    supabase.from('users').select('*').order('name').then(({ data }) => {
      if (data) setUsers(data as User[])
    })
  }, [])

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const uploadImage = async (file: File, side: 'before' | 'after') => {
    const setter = side === 'before' ? setUploadingBefore : setUploadingAfter
    setter(true)
    const path = `${side}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('improvements').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('improvements').getPublicUrl(path)
      const key = side === 'before' ? 'before_images' : 'after_images'
      set(key, [...form[key], data.publicUrl])
    }
    setter(false)
  }

  const handleSubmit = async () => {
    setSaving(true)
    const { data: imp, error } = await supabase
      .from('improvements')
      .insert({
        title: form.title,
        area: form.area,
        date_submitted: form.date_submitted,
        status: 'submitted',
        problem_description: form.problem_description,
        sqdcm_targeted: form.sqdcm_targeted,
        expected_objective: form.expected_objective,
        problem_impact: form.problem_impact,
        current_state: form.current_state.filter(Boolean),
        desired_state: form.desired_state.filter(Boolean),
        root_cause_method: form.root_cause_method,
        five_whys: form.five_whys,
        ishikawa_causes: form.ishikawa_causes,
        solutions: form.solutions,
        chosen_solution: form.chosen_solution,
        dev_planning: form.dev_planning,
        dev_resources: form.dev_resources,
        dev_implementation: form.dev_implementation,
        dev_followup: form.dev_followup,
        before_images: form.before_images,
        after_images: form.after_images,
        result_indicators: form.result_indicators,
        new_standards: form.new_standards.filter(Boolean),
        sqdcm_impact: form.sqdcm_impact,
        pdca_plan: form.pdca_plan,
        pdca_do: form.pdca_do,
        pdca_check: form.pdca_check,
        pdca_act: form.pdca_act,
        next_steps_responsible: form.next_steps_responsible,
        next_steps_date: form.next_steps_date || null,
        next_steps_followup: form.next_steps_followup,
      })
      .select()
      .single()

    if (error || !imp) { setSaving(false); alert('Error saving'); return }

    if (form.participant_ids.length > 0) {
      await supabase.from('improvement_participants').insert(
        form.participant_ids.map(uid => ({
          improvement_id: imp.id,
          user_id: uid,
          role_in_project: form.participant_roles[uid] || '',
        }))
      )
    }

    setSaving(false)
    navigate(`/improvements/${imp.id}`)
  }

  const steps = [
    // Step 0 — Cover
    <div key={0} className="space-y-4">
      <TextInput label={t('form.step1.improvementName')} value={form.title} onChange={v => set('title', v)} />
      <TextInput label={t('form.step1.area')} value={form.area} onChange={v => set('area', v)} />
      <TextInput label={t('form.step1.date')} value={form.date_submitted} onChange={v => set('date_submitted', v)} type="date" />
    </div>,

    // Step 1 — Problem
    <div key={1} className="space-y-4">
      <TextArea
        label={t('form.step2.problemDescription')}
        value={form.problem_description}
        onChange={v => set('problem_description', v)}
        hint={t('form.step2.problemDescriptionHint')}
        rows={4}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.step2.sqdcmTargeted')}</label>
        <div className="flex gap-2 flex-wrap">
          {SQDCM_CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => {
                const curr = form.sqdcm_targeted
                set('sqdcm_targeted', curr.includes(c) ? curr.filter(x => x !== c) : [...curr, c])
              }}
              className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                form.sqdcm_targeted.includes(c)
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:border-blue-400'
              }`}
            >
              {c} — {t(`sqdcm.${c}`)}
            </button>
          ))}
        </div>
      </div>
      <TextArea label={t('form.step2.expectedObjective')} value={form.expected_objective} onChange={v => set('expected_objective', v)} hint={t('form.step2.expectedObjectiveHint')} />
      <TextArea label={t('form.step2.problemImpact')} value={form.problem_impact} onChange={v => set('problem_impact', v)} hint={t('form.step2.problemImpactHint')} />
    </div>,

    // Step 2 — Current vs Desired
    <div key={2} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">{t('form.step3.currentState')}</h3>
        <div className="space-y-2">
          {form.current_state.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={s}
                onChange={e => {
                  const arr = [...form.current_state]; arr[i] = e.target.value; set('current_state', arr)
                }}
                placeholder={`• ${t('form.step3.currentStatePlaceholder')}`}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => set('current_state', form.current_state.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => set('current_state', [...form.current_state, ''])} className="text-blue-600 text-sm flex items-center gap-1 mt-1"><Plus size={14} />{t('form.step3.addPoint')}</button>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">{t('form.step3.desiredState')}</h3>
        <div className="space-y-2">
          {form.desired_state.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={s}
                onChange={e => {
                  const arr = [...form.desired_state]; arr[i] = e.target.value; set('desired_state', arr)
                }}
                placeholder={`• ${t('form.step3.desiredStatePlaceholder')}`}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => set('desired_state', form.desired_state.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => set('desired_state', [...form.desired_state, ''])} className="text-blue-600 text-sm flex items-center gap-1 mt-1"><Plus size={14} />{t('form.step3.addPoint')}</button>
        </div>
      </div>
      <p className="text-xs text-gray-400 md:col-span-2">{t('form.step3.hint')}</p>
    </div>,

    // Step 3 — Team
    <div key={3} className="space-y-3">
      <p className="text-sm text-gray-500">{t('form.step4.hint')}</p>
      <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
        {users.map(u => {
          const selected = form.participant_ids.includes(u.id)
          return (
            <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => {
                  if (selected) {
                    set('participant_ids', form.participant_ids.filter(id => id !== u.id))
                  } else {
                    set('participant_ids', [...form.participant_ids, u.id])
                  }
                }}
                className="rounded border-gray-300 text-blue-600"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{u.name}</p>
                <p className="text-xs text-gray-400">{u.area} · {u.role}</p>
              </div>
              {selected && (
                <input
                  value={form.participant_roles[u.id] || ''}
                  onChange={e => set('participant_roles', { ...form.participant_roles, [u.id]: e.target.value })}
                  placeholder={t('form.step4.roleInProject')}
                  className="w-40 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>,

    // Step 4 — Root Cause
    <div key={4} className="space-y-4">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => set('root_cause_method', '5whys')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${form.root_cause_method === '5whys' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600'}`}
        >{t('form.step5.fiveWhys')}</button>
        <button
          type="button"
          onClick={() => set('root_cause_method', 'ishikawa')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${form.root_cause_method === 'ishikawa' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600'}`}
        >{t('form.step5.ishikawa')}</button>
      </div>
      {form.root_cause_method === '5whys' ? (
        <div className="space-y-3">
          {form.five_whys.map((w, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold text-blue-700">{t('form.step5.why')} {i + 1}{i === 4 ? ` — ${t('form.step5.rootCause')}` : ''}</p>
              <textarea
                value={w.answer}
                onChange={e => {
                  const arr = [...form.five_whys]; arr[i] = { ...arr[i], answer: e.target.value }; set('five_whys', arr)
                }}
                rows={2}
                placeholder={t('form.step5.answer')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {form.ishikawa_causes.map((c, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-semibold text-blue-700 mb-1">{t(`form.step5.branches.${c.branch}`)}</p>
              <input
                value={c.cause}
                onChange={e => {
                  const arr = [...form.ishikawa_causes]; arr[i] = { ...arr[i], cause: e.target.value }; set('ishikawa_causes', arr)
                }}
                placeholder={t('form.step5.cause')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400">{t('form.step5.hint')}</p>
    </div>,

    // Step 5 — Solutions
    <div key={5} className="space-y-4">
      <p className="text-xs text-gray-400">{t('form.step6.hint')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left px-3 py-2 rounded-l">{t('form.step6.solution')}</th>
              <th className="text-left px-3 py-2">{t('form.step6.description')}</th>
              <th className="px-3 py-2">{t('form.step6.impact')}</th>
              <th className="px-3 py-2">{t('form.step6.ease')}</th>
              <th className="px-3 py-2">{t('form.step6.cost')}</th>
              <th className="px-3 py-2">{t('form.step6.risk')}</th>
              <th className="px-3 py-2 rounded-r">{t('form.step6.total')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {form.solutions.map((s, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-bold text-blue-700">{s.label}</td>
                <td className="px-3 py-2">
                  <textarea
                    value={s.description}
                    onChange={e => { const arr = [...form.solutions]; arr[i] = { ...arr[i], description: e.target.value }; set('solutions', arr) }}
                    rows={2}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                {(['impact', 'ease', 'cost', 'risk'] as const).map(field => (
                  <td key={field} className="px-3 py-2">
                    <input
                      type="number" min={1} max={5}
                      value={s[field] || ''}
                      onChange={e => { const arr = [...form.solutions]; arr[i] = { ...arr[i], [field]: Number(e.target.value) }; set('solutions', arr) }}
                      className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-bold text-blue-700">
                  {(s.impact || 0) + (s.ease || 0) + (s.cost || 0) + (s.risk || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => set('solutions', [...form.solutions, { label: String.fromCharCode(65 + form.solutions.length), description: '', impact: 0, ease: 0, cost: 0, risk: 0 }])}
        className="text-blue-600 text-sm flex items-center gap-1"
      ><Plus size={14} />{t('common.add')}</button>
      <TextArea label={t('form.step6.chosenSolution')} value={form.chosen_solution} onChange={v => set('chosen_solution', v)} rows={2} />
    </div>,

    // Step 6 — Development
    <div key={6} className="space-y-4">
      <TextArea label={t('form.step7.planning')} value={form.dev_planning} onChange={v => set('dev_planning', v)} hint={t('form.step7.planningHint')} rows={3} />
      <TextArea label={t('form.step7.resources')} value={form.dev_resources} onChange={v => set('dev_resources', v)} hint={t('form.step7.resourcesHint')} rows={3} />
      <TextArea label={t('form.step7.implementation')} value={form.dev_implementation} onChange={v => set('dev_implementation', v)} hint={t('form.step7.implementationHint')} rows={3} />
      <TextArea label={t('form.step7.followup')} value={form.dev_followup} onChange={v => set('dev_followup', v)} hint={t('form.step7.followupHint')} rows={3} />
    </div>,

    // Step 7 — Before/After Images
    <div key={7} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {(['before', 'after'] as const).map(side => (
        <div key={side}>
          <h3 className="font-semibold text-gray-800 mb-3">{t(`form.step8.${side}`)}</h3>
          <label className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Upload size={24} className="text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">{t(`form.step8.upload${side === 'before' ? 'Before' : 'After'}`)}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], side)}
            />
          </label>
          {(side === 'before' ? uploadingBefore : uploadingAfter) && (
            <p className="text-xs text-blue-500 mt-2">{t('common.loading')}</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(side === 'before' ? form.before_images : form.after_images).map((url, i) => (
              <div key={i} className="relative group">
                <img src={url} alt="" className="w-full h-24 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => {
                    const key = side === 'before' ? 'before_images' : 'after_images'
                    set(key, (form[key] as string[]).filter((_, j) => j !== i))
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                ><X size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400 md:col-span-2">{t('form.step8.hint')}</p>
    </div>,

    // Step 8 — Results
    <div key={8} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left px-3 py-2 rounded-l">{t('form.step9.indicator')}</th>
              <th className="px-3 py-2">{t('form.step9.before')}</th>
              <th className="px-3 py-2">{t('form.step9.after')}</th>
              <th className="px-3 py-2 rounded-r">{t('form.step9.improvementPct')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {form.result_indicators.map((ind, i) => (
              <tr key={i}>
                {(['name', 'before', 'after', 'improvement'] as const).map(field => (
                  <td key={field} className="px-3 py-2">
                    <input
                      value={ind[field]}
                      onChange={e => {
                        const arr = [...form.result_indicators]; arr[i] = { ...arr[i], [field]: e.target.value }; set('result_indicators', arr)
                      }}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => set('result_indicators', [...form.result_indicators, { name: '', before: '', after: '', improvement: '' }])}
        className="text-blue-600 text-sm flex items-center gap-1"
      ><Plus size={14} />{t('form.step9.addIndicator')}</button>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.step9.newStandards')}</label>
        <div className="space-y-2">
          {form.new_standards.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={s}
                onChange={e => { const arr = [...form.new_standards]; arr[i] = e.target.value; set('new_standards', arr) }}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`${t('form.step9.newStandards')} ${i + 1}`}
              />
              <button type="button" onClick={() => set('new_standards', form.new_standards.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => set('new_standards', [...form.new_standards, ''])} className="text-blue-600 text-sm flex items-center gap-1"><Plus size={14} />{t('form.step9.addStandard')}</button>
        </div>
      </div>
    </div>,

    // Step 9 — SQDCM Impact
    <div key={9} className="space-y-4">
      <p className="text-xs text-gray-400">{t('form.step10.hint')}</p>
      {form.sqdcm_impact.map((imp, i) => (
        <div key={imp.category} className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-lg flex items-center justify-center">{imp.category}</span>
            <span className="font-semibold text-gray-800">{t(`sqdcm.${imp.category}`)}</span>
          </div>
          <textarea
            value={imp.description}
            onChange={e => {
              const arr = [...form.sqdcm_impact]; arr[i] = { ...arr[i], description: e.target.value }; set('sqdcm_impact', arr)
            }}
            rows={2}
            placeholder={t('form.step10.describeImpact')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex gap-3">
            {(['high', 'medium', 'none'] as ImpactLevel[]).map(level => (
              <label key={level} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={`impact_${imp.category}`}
                  checked={imp.impact_level === level}
                  onChange={() => {
                    const arr = [...form.sqdcm_impact]; arr[i] = { ...arr[i], impact_level: level }; set('sqdcm_impact', arr)
                  }}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">{t(`sqdcm.impact.${level}`)}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>,

    // Step 10 — PDCA
    <div key={10} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['plan', 'do', 'check', 'act'] as const).map(phase => (
          <div key={phase} className="bg-gray-50 rounded-xl p-4">
            <p className="font-bold text-blue-700 uppercase text-sm mb-2">{phase.toUpperCase()}</p>
            <textarea
              value={form[`pdca_${phase}` as keyof FormData] as string}
              onChange={e => set(`pdca_${phase}` as keyof FormData, e.target.value as never)}
              rows={3}
              placeholder={t(`form.step11.${phase}`)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
            />
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="font-semibold text-gray-700 text-sm">{t('form.step11.nextSteps')}</p>
        <TextInput label={t('form.step11.responsible')} value={form.next_steps_responsible} onChange={v => set('next_steps_responsible', v)} />
        <TextInput label={t('form.step11.commitmentDate')} value={form.next_steps_date} onChange={v => set('next_steps_date', v)} type="date" />
        <TextArea label={t('form.step11.followup')} value={form.next_steps_followup} onChange={v => set('next_steps_followup', v)} rows={2} />
      </div>
    </div>,
  ]

  const stepTitles = [
    t('form.step1.title'), t('form.step2.title'), t('form.step3.title'), t('form.step4.title'),
    t('form.step5.title'), t('form.step6.title'), t('form.step7.title'), t('form.step8.title'),
    t('form.step9.title'), t('form.step10.title'), t('form.step11.title'),
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.submit')}</h1>
        <div className="mt-3">
          <StepIndicator current={step} total={TOTAL_STEPS} />
          <p className="text-sm text-gray-500 mt-2">
            {t('common.step', { defaultValue: `Step ${step + 1} of ${TOTAL_STEPS}` })} — <span className="font-medium text-gray-700">{stepTitles[step]}</span>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">{stepTitles[step]}</h2>
        {steps[step]}
      </div>

      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />{t('common.back')}
        </button>
        {step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {t('common.next')}<ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            <Check size={16} />{saving ? t('common.loading') : t('common.submit')}
          </button>
        )}
      </div>
    </div>
  )
}
