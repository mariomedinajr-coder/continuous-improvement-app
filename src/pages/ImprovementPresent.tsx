import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft, ChevronRight, X,
  MapPin, Calendar, Users, Star, Award, Sparkles,
  AlertCircle, Target, GitBranch, Lightbulb, Wrench,
  Camera, TrendingUp, BarChart3, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {
  Improvement, ImprovementParticipant, PointAssignment,
  SQDCMCategory, ImpactLevel,
} from '../types'

// ── Palette ───────────────────────────────────────────────────────────────────

const SQDCM_GRADIENT: Record<SQDCMCategory, string> = {
  S: 'from-blue-500 to-blue-600',
  Q: 'from-purple-500 to-purple-600',
  D: 'from-amber-500 to-amber-600',
  C: 'from-emerald-500 to-emerald-600',
  M: 'from-rose-500 to-rose-600',
}

const SQDCM_CHIP: Record<SQDCMCategory, string> = {
  S: 'bg-blue-100 text-blue-700 border-blue-200',
  Q: 'bg-purple-100 text-purple-700 border-purple-200',
  D: 'bg-amber-100 text-amber-700 border-amber-200',
  C: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  M: 'bg-rose-100 text-rose-700 border-rose-200',
}

const STATUS_BG: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  implemented: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

const IMPACT_BG: Record<ImpactLevel, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  none: 'bg-gray-100 text-gray-500',
}

const PDCA_STYLES: Record<string, string> = {
  plan:  'bg-blue-50 border-blue-100 text-blue-700',
  do:    'bg-amber-50 border-amber-100 text-amber-700',
  check: 'bg-purple-50 border-purple-100 text-purple-700',
  act:   'bg-emerald-50 border-emerald-100 text-emerald-700',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-300 italic text-center text-lg py-12">{children}</p>
}

interface ShellProps {
  index: number
  total: number
  titleKey: string
  accent: string
  icon: React.ReactNode
  children: React.ReactNode
}

function SlideShell({ index, total, titleKey, accent, icon, children }: ShellProps) {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 bg-white flex flex-col">
      <div className={`h-2 w-full bg-gradient-to-r ${accent}`} />
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 sm:py-10 flex flex-col">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center shadow-sm`}>
            {icon}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">{t(titleKey)}</h2>
        </div>
        <div className="flex-1">{children}</div>
      </div>
      <div className="px-6 sm:px-12 py-3 border-t border-gray-100 flex items-center justify-between text-xs sm:text-sm text-gray-400">
        <span>{t('present.title')}</span>
        <span>{index + 1} / {total}</span>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ImprovementPresent() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [improvement, setImprovement] = useState<Improvement | null>(null)
  const [participants, setParticipants] = useState<ImprovementParticipant[]>([])
  const [assignments, setAssignments] = useState<PointAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('improvements').select('*').eq('id', id).single(),
      supabase.from('improvement_participants').select('*, user:users(id,name,area,job_title)').eq('improvement_id', id),
      supabase.from('point_assignments').select('*, user:users(id,name,area)').eq('improvement_id', id),
    ]).then(([{ data: imp }, { data: parts }, { data: assigns }]) => {
      if (imp) setImprovement(imp as Improvement)
      if (parts) setParticipants(parts as ImprovementParticipant[])
      if (assigns) setAssignments(assigns as PointAssignment[])
      setLoading(false)
    })
  }, [id])

  const total = 12

  const goNext = useCallback(() => setCurrent(c => Math.min(total - 1, c + 1)), [])
  const goPrev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), [])
  const exit = useCallback(() => navigate(`/improvements/${id}`), [navigate, id])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); goNext() }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPrev() }
      else if (e.key === 'Escape') exit()
      else if (e.key === 'Home') setCurrent(0)
      else if (e.key === 'End') setCurrent(total - 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev, exit])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="animate-spin border-4 border-blue-600 border-t-transparent rounded-full w-12 h-12" />
      </div>
    )
  }

  if (!improvement) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Improvement not found</p>
        <button onClick={exit} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{t('present.exit')}</button>
      </div>
    )
  }

  const imp = improvement
  const totalPoints = assignments.reduce((sum, a) => sum + a.points, 0)
  const sqdcmTargeted = imp.sqdcm_targeted as SQDCMCategory[]
  const currentState = imp.current_state as string[]
  const desiredState = imp.desired_state as string[]
  const fiveWhys = (imp.five_whys as { question: string; answer: string }[]).filter(w => w.answer)
  const ishikawa = (imp.ishikawa_causes as { branch: string; cause: string }[]).filter(c => c.cause)
  const solutions = imp.solutions as { label: string; description: string; impact: number; ease: number; cost: number; risk: number }[]
  const beforeImgs = imp.before_images as string[]
  const afterImgs = imp.after_images as string[]
  const indicators = imp.result_indicators as { name: string; before: string; after: string; improvement: string }[]
  const standards = imp.new_standards as string[]
  const impacts = imp.sqdcm_impact as { category: SQDCMCategory; description: string; impact_level: ImpactLevel }[]

  const slides: React.ReactNode[] = [
    // ── 1. Cover ──────────────────────────────────────────────────────────────
    <SlideShell
      key="cover"
      index={0}
      total={total}
      titleKey="form.step1.title"
      accent={sqdcmTargeted[0] ? SQDCM_GRADIENT[sqdcmTargeted[0]] : 'from-blue-500 to-indigo-600'}
      icon={<Sparkles size={22} />}
    >
      <div className="h-full flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
        <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 ${STATUS_BG[imp.status]}`}>
          {t(`status.${imp.status}`)}
        </span>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
          {imp.title}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-gray-500 text-base sm:text-lg">
          <span className="flex items-center gap-2"><MapPin size={18} />{imp.area}</span>
          <span className="flex items-center gap-2"><Calendar size={18} />{imp.date_submitted}</span>
          <span className="flex items-center gap-2"><Users size={18} />{participants.length} {t('improvements.totalParticipants')}</span>
        </div>
      </div>
    </SlideShell>,

    // ── 2. Problem ────────────────────────────────────────────────────────────
    <SlideShell key="problem" index={1} total={total} titleKey="form.step2.title" accent="from-rose-500 to-red-600" icon={<AlertCircle size={22} />}>
      <div className="space-y-6">
        {imp.problem_description ? (
          <p className="text-xl sm:text-2xl text-gray-800 leading-relaxed font-light max-w-4xl">
            {imp.problem_description}
          </p>
        ) : <Empty>{t('present.notProvided')}</Empty>}

        {sqdcmTargeted.length > 0 && (
          <div>
            <p className="text-xs uppercase font-bold text-gray-400 mb-2 tracking-wider">{t('form.step2.sqdcmTargeted')}</p>
            <div className="flex flex-wrap gap-3">
              {sqdcmTargeted.map(c => (
                <span key={c} className={`px-4 py-1.5 rounded-full text-sm font-bold border ${SQDCM_CHIP[c]}`}>
                  {c} — {t(`sqdcm.${c}`)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <p className="text-xs uppercase font-bold text-gray-400 mb-2 tracking-wider">{t('form.step2.expectedObjective')}</p>
            <p className="text-base text-gray-700">{imp.expected_objective || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <p className="text-xs uppercase font-bold text-gray-400 mb-2 tracking-wider">{t('form.step2.problemImpact')}</p>
            <p className="text-base text-gray-700">{imp.problem_impact || '—'}</p>
          </div>
        </div>
      </div>
    </SlideShell>,

    // ── 3. Current vs Desired ─────────────────────────────────────────────────
    <SlideShell key="states" index={2} total={total} titleKey="form.step3.title" accent="from-amber-500 to-orange-600" icon={<Target size={22} />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 sm:p-8">
          <p className="text-xs uppercase font-bold text-rose-700 mb-4 tracking-wider">{t('form.step3.currentState')}</p>
          {currentState.length > 0 ? (
            <ul className="space-y-3">
              {currentState.map((s, i) => (
                <li key={i} className="text-base sm:text-lg text-gray-700 flex gap-2"><span className="text-rose-400 shrink-0">●</span>{s}</li>
              ))}
            </ul>
          ) : <Empty>{t('present.notProvided')}</Empty>}
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 sm:p-8">
          <p className="text-xs uppercase font-bold text-emerald-700 mb-4 tracking-wider">{t('form.step3.desiredState')}</p>
          {desiredState.length > 0 ? (
            <ul className="space-y-3">
              {desiredState.map((s, i) => (
                <li key={i} className="text-base sm:text-lg text-gray-700 flex gap-2"><span className="text-emerald-500 shrink-0">→</span>{s}</li>
              ))}
            </ul>
          ) : <Empty>{t('present.notProvided')}</Empty>}
        </div>
      </div>
    </SlideShell>,

    // ── 4. Team ───────────────────────────────────────────────────────────────
    <SlideShell key="team" index={3} total={total} titleKey="form.step4.title" accent="from-blue-500 to-indigo-600" icon={<Users size={22} />}>
      {participants.length === 0 ? <Empty>{t('present.notProvided')}</Empty> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {participants.map(p => (
            <div key={p.id} className="flex items-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-sm shrink-0">
                {p.user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-800 truncate">{p.user?.name}</p>
                <p className="text-sm text-gray-500 truncate">{p.user?.area}</p>
                {p.role_in_project && <p className="text-xs text-blue-700 font-medium mt-0.5 truncate">{p.role_in_project}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </SlideShell>,

    // ── 5. Root Cause ─────────────────────────────────────────────────────────
    <SlideShell key="rootcause" index={4} total={total} titleKey="form.step5.title" accent="from-purple-500 to-fuchsia-600" icon={<GitBranch size={22} />}>
      {imp.root_cause_method === '5whys' ? (
        fiveWhys.length === 0 ? <Empty>{t('present.notProvided')}</Empty> : (
          <div className="space-y-3 max-w-4xl">
            {fiveWhys.map((w, i) => (
              <div key={i} className="flex gap-4 items-start bg-purple-50 rounded-2xl p-5 border border-purple-100">
                <span className="shrink-0 w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center">{i + 1}</span>
                <div>
                  <p className="text-xs uppercase font-bold text-purple-700 tracking-wider">{t('form.step5.why')} {i + 1}</p>
                  <p className="text-base text-gray-700 mt-0.5">{w.answer}</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        ishikawa.length === 0 ? <Empty>{t('present.notProvided')}</Empty> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ishikawa.map((c, i) => (
              <div key={i} className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <p className="text-xs uppercase font-bold text-purple-700 mb-1 tracking-wider">{t(`form.step5.branches.${c.branch}`)}</p>
                <p className="text-sm text-gray-700">{c.cause}</p>
              </div>
            ))}
          </div>
        )
      )}
    </SlideShell>,

    // ── 6. Solutions ──────────────────────────────────────────────────────────
    <SlideShell key="solutions" index={5} total={total} titleKey="form.step6.title" accent="from-yellow-500 to-amber-600" icon={<Lightbulb size={22} />}>
      <div className="space-y-6">
        {solutions.length === 0 ? <Empty>{t('present.notProvided')}</Empty> : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">{t('form.step6.solution')}</th>
                  <th className="text-left px-4 py-3">{t('form.step6.description')}</th>
                  <th className="px-3 py-3">{t('form.step6.impact')}</th>
                  <th className="px-3 py-3">{t('form.step6.ease')}</th>
                  <th className="px-3 py-3">{t('form.step6.cost')}</th>
                  <th className="px-3 py-3">{t('form.step6.risk')}</th>
                  <th className="px-3 py-3">{t('form.step6.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {solutions.map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-amber-700">{s.label}</td>
                    <td className="px-4 py-3 text-gray-700">{s.description}</td>
                    <td className="px-3 py-3 text-center">{s.impact}</td>
                    <td className="px-3 py-3 text-center">{s.ease}</td>
                    <td className="px-3 py-3 text-center">{s.cost}</td>
                    <td className="px-3 py-3 text-center">{s.risk}</td>
                    <td className="px-3 py-3 text-center font-bold text-amber-700">{s.impact + s.ease + s.cost + s.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {imp.chosen_solution && (
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-6">
            <p className="text-xs uppercase font-bold text-emerald-700 mb-2 tracking-wider">{t('form.step6.chosenSolution')}</p>
            <p className="text-lg sm:text-xl text-gray-800 font-medium">{imp.chosen_solution}</p>
          </div>
        )}
      </div>
    </SlideShell>,

    // ── 7. Development ────────────────────────────────────────────────────────
    <SlideShell key="development" index={6} total={total} titleKey="form.step7.title" accent="from-slate-500 to-slate-700" icon={<Wrench size={22} />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([
          ['planning', 'dev_planning'],
          ['resources', 'dev_resources'],
          ['implementation', 'dev_implementation'],
          ['followup', 'dev_followup'],
        ] as const).map(([labelKey, dataKey]) => (
          <div key={labelKey} className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
            <p className="text-xs uppercase font-bold text-slate-600 mb-2 tracking-wider">
              {t(`form.step7.${labelKey}`)}
            </p>
            <p className="text-base text-gray-700 whitespace-pre-wrap">
              {(imp[dataKey] as string) || '—'}
            </p>
          </div>
        ))}
      </div>
    </SlideShell>,

    // ── 8. Before / After ─────────────────────────────────────────────────────
    <SlideShell key="beforeafter" index={7} total={total} titleKey="form.step8.title" accent="from-cyan-500 to-blue-600" icon={<Camera size={22} />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs uppercase font-bold text-gray-400 mb-3 tracking-wider">{t('form.step8.before')}</p>
          {beforeImgs.length === 0 ? <Empty>{t('present.notProvided')}</Empty> : (
            <div className="grid grid-cols-2 gap-3">
              {beforeImgs.map((url, i) => (
                <img key={i} src={url} alt="" className="w-full h-44 object-cover rounded-xl border border-gray-200" />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs uppercase font-bold text-emerald-600 mb-3 tracking-wider">{t('form.step8.after')}</p>
          {afterImgs.length === 0 ? <Empty>{t('present.notProvided')}</Empty> : (
            <div className="grid grid-cols-2 gap-3">
              {afterImgs.map((url, i) => (
                <img key={i} src={url} alt="" className="w-full h-44 object-cover rounded-xl border-2 border-emerald-200" />
              ))}
            </div>
          )}
        </div>
      </div>
    </SlideShell>,

    // ── 9. Results ────────────────────────────────────────────────────────────
    <SlideShell key="results" index={8} total={total} titleKey="form.step9.title" accent="from-emerald-500 to-green-600" icon={<TrendingUp size={22} />}>
      <div className="space-y-6">
        {indicators.length === 0 ? <Empty>{t('present.notProvided')}</Empty> : (
          <div className="space-y-3">
            {indicators.map((r, i) => (
              <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                <div>
                  <p className="text-xs uppercase font-bold text-emerald-700 tracking-wider">{t('form.step9.indicator')}</p>
                  <p className="text-base sm:text-lg font-semibold text-gray-800">{r.name}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase text-gray-400 tracking-wider">{t('form.step9.before')}</p>
                  <p className="text-lg sm:text-xl font-medium text-gray-600">{r.before}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase text-gray-400 tracking-wider">{t('form.step9.after')}</p>
                  <p className="text-lg sm:text-xl font-medium text-gray-600">{r.after}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase text-emerald-700 tracking-wider">{t('form.step9.improvementPct')}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{r.improvement}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {standards.length > 0 && (
          <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
            <p className="text-xs uppercase font-bold text-blue-700 mb-2 tracking-wider">{t('form.step9.newStandards')}</p>
            <ul className="space-y-1">
              {standards.map((s, i) => (
                <li key={i} className="text-base text-gray-700 flex gap-2"><span className="text-blue-500 shrink-0">✓</span>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SlideShell>,

    // ── 10. SQDCM Impact ──────────────────────────────────────────────────────
    <SlideShell key="sqdcm-impact" index={9} total={total} titleKey="form.step10.title" accent="from-indigo-500 to-purple-600" icon={<BarChart3 size={22} />}>
      {impacts.length === 0 ? <Empty>{t('present.notProvided')}</Empty> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {impacts.map(im => (
            <div key={im.category} className="border border-gray-100 rounded-2xl p-5 space-y-3 bg-white shadow-sm">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${SQDCM_GRADIENT[im.category]} text-white font-bold text-2xl flex items-center justify-center shadow-sm`}>
                {im.category}
              </div>
              <p className="text-sm font-semibold text-gray-700">{t(`sqdcm.${im.category}`)}</p>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${IMPACT_BG[im.impact_level]}`}>
                {t(`sqdcm.impact.${im.impact_level}`)}
              </span>
              {im.description && <p className="text-sm text-gray-500 leading-relaxed">{im.description}</p>}
            </div>
          ))}
        </div>
      )}
    </SlideShell>,

    // ── 11. PDCA ──────────────────────────────────────────────────────────────
    <SlideShell key="pdca" index={10} total={total} titleKey="form.step11.title" accent="from-teal-500 to-cyan-600" icon={<RefreshCw size={22} />}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['plan', 'do', 'check', 'act'] as const).map(phase => (
            <div key={phase} className={`rounded-2xl p-5 border min-h-[160px] ${PDCA_STYLES[phase]}`}>
              <p className="text-2xl font-bold mb-2">{phase.toUpperCase()}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{(imp[`pdca_${phase}` as keyof Improvement] as string) || '—'}</p>
            </div>
          ))}
        </div>
        {(imp.next_steps_responsible || imp.next_steps_date || imp.next_steps_followup) && (
          <div className="flex flex-wrap gap-4 text-sm bg-gray-50 rounded-2xl p-4 border border-gray-100">
            {imp.next_steps_responsible && (
              <span><span className="font-bold text-gray-500">{t('form.step11.responsible')}:</span> {imp.next_steps_responsible}</span>
            )}
            {imp.next_steps_date && (
              <span><span className="font-bold text-gray-500">{t('form.step11.commitmentDate')}:</span> {imp.next_steps_date}</span>
            )}
            {imp.next_steps_followup && (
              <span><span className="font-bold text-gray-500">{t('form.step11.followup')}:</span> {imp.next_steps_followup}</span>
            )}
          </div>
        )}
      </div>
    </SlideShell>,

    // ── 12. Recognition ───────────────────────────────────────────────────────
    <SlideShell key="recognition" index={11} total={total} titleKey="present.recognitionTitle" accent="from-yellow-400 to-amber-500" icon={<Award size={22} />}>
      <div className="h-full flex flex-col items-center justify-center text-center gap-6 sm:gap-8 max-w-4xl mx-auto">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
          <Award size={48} className="text-white" />
        </div>
        {totalPoints > 0 ? (
          <>
            <p className="text-4xl sm:text-5xl font-bold text-gray-900">
              {totalPoints} <span className="text-xl sm:text-2xl text-gray-500 font-normal">{t('common.points')}</span>
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {assignments.map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-5 py-2">
                  <Star size={16} className="text-yellow-500" fill="currentColor" />
                  <span className="text-base font-medium text-gray-800">{a.user?.name}</span>
                  <span className="text-base font-bold text-yellow-700">{a.points}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xl sm:text-2xl text-gray-500 font-light">{t('present.noPointsYet')}</p>
        )}
        <p className="text-2xl sm:text-3xl font-light text-gray-700 mt-4">{t('present.thanksMessage')}</p>
      </div>
    </SlideShell>,
  ]

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div className="absolute inset-x-0 top-0 bottom-16">
        {slides[current]}
      </div>

      <button
        onClick={exit}
        className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/95 hover:bg-gray-100 border border-gray-200 text-gray-500 shadow-sm transition-colors"
        aria-label={t('present.exit')}
        title={t('present.exit')}
      >
        <X size={20} />
      </button>

      <div className="absolute bottom-0 inset-x-0 h-16 bg-white border-t border-gray-100 px-4 sm:px-6 flex items-center justify-between gap-4">
        <button
          onClick={goPrev}
          disabled={current === 0}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium text-gray-700 transition-colors"
        >
          <ChevronLeft size={18} />
          <span className="hidden sm:inline">{t('common.back')}</span>
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all shrink-0 ${
                i === current ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={current === total - 1}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          <span className="hidden sm:inline">{t('common.next')}</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
