import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Users, Calendar, MapPin, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Improvement, ImprovementParticipant, PointAssignment, SQDCMCategory, ImpactLevel } from '../types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  implemented: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  none: 'bg-gray-100 text-gray-400',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
      <h3 className="font-semibold text-gray-800 text-base border-b border-gray-100 pb-2">{title}</h3>
      {children}
    </div>
  )
}

export default function ImprovementDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [improvement, setImprovement] = useState<Improvement | null>(null)
  const [participants, setParticipants] = useState<ImprovementParticipant[]>([])
  const [assignments, setAssignments] = useState<PointAssignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('improvements').select('*').eq('id', id).single(),
      supabase.from('improvement_participants').select('*, user:users(id,name,area,role)').eq('improvement_id', id),
      supabase.from('point_assignments').select('*, user:users(id,name,area)').eq('improvement_id', id),
    ]).then(([{ data: imp }, { data: parts }, { data: assigns }]) => {
      if (imp) setImprovement(imp as Improvement)
      if (parts) setParticipants(parts as ImprovementParticipant[])
      if (assigns) setAssignments(assigns as PointAssignment[])
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center mt-20">
      <div className="animate-spin border-4 border-blue-600 border-t-transparent rounded-full w-8 h-8" />
    </div>
  )

  if (!improvement) return (
    <div className="text-center mt-20 text-gray-500">Improvement not found</div>
  )

  const totalPoints = assignments.reduce((sum, a) => sum + a.points, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/improvements" className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{improvement.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1"><MapPin size={14} />{improvement.area}</span>
            <span className="flex items-center gap-1"><Calendar size={14} />{improvement.date_submitted}</span>
            <span className="flex items-center gap-1"><Users size={14} />{participants.length} {t('improvements.totalParticipants')}</span>
            {totalPoints > 0 && <span className="flex items-center gap-1 text-yellow-600 font-medium"><Star size={14} fill="currentColor" />{totalPoints} pts</span>}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[improvement.status]}`}>
          {t(`status.${improvement.status}`)}
        </span>
      </div>

      {/* Problem */}
      <Section title={t('form.step2.title')}>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">{t('form.step2.problemDescription')}</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{improvement.problem_description}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">{t('form.step2.sqdcmTargeted')}</p>
          <div className="flex gap-2 flex-wrap">
            {(improvement.sqdcm_targeted as SQDCMCategory[]).map(c => (
              <span key={c} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{c} — {t(`sqdcm.${c}`)}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">{t('form.step2.expectedObjective')}</p>
          <p className="text-sm text-gray-700">{improvement.expected_objective}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">{t('form.step2.problemImpact')}</p>
          <p className="text-sm text-gray-700">{improvement.problem_impact}</p>
        </div>
      </Section>

      {/* Current vs Desired */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title={t('form.step3.currentState')}>
          <ul className="space-y-1">
            {(improvement.current_state as string[]).map((s, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-gray-400">•</span>{s}</li>
            ))}
          </ul>
        </Section>
        <Section title={t('form.step3.desiredState')}>
          <ul className="space-y-1">
            {(improvement.desired_state as string[]).map((s, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-emerald-500">→</span>{s}</li>
            ))}
          </ul>
        </Section>
      </div>

      {/* Team */}
      {participants.length > 0 && (
        <Section title={t('form.step4.title')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  {p.user?.name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.user?.name}</p>
                  <p className="text-xs text-gray-400">{p.user?.area} · {p.role_in_project}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Root Cause */}
      <Section title={t('form.step5.title')}>
        <p className="text-xs font-medium text-gray-500 uppercase">{improvement.root_cause_method === '5whys' ? t('form.step5.fiveWhys') : t('form.step5.ishikawa')}</p>
        {improvement.root_cause_method === '5whys' ? (
          <div className="space-y-2">
            {(improvement.five_whys as { question: string; answer: string }[]).filter(w => w.answer).map((w, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="font-bold text-blue-600 shrink-0">{t('form.step5.why')} {i + 1}:</span>
                <span className="text-gray-700">{w.answer}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {(improvement.ishikawa_causes as { branch: string; cause: string }[]).filter(c => c.cause).map((c, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs font-bold text-blue-700">{t(`form.step5.branches.${c.branch}`)}</p>
                <p className="text-xs text-gray-600 mt-0.5">{c.cause}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Solutions */}
      <Section title={t('form.step6.title')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-3 py-2">{t('form.step6.solution')}</th>
                <th className="text-left px-3 py-2">{t('form.step6.description')}</th>
                <th className="px-3 py-2">{t('form.step6.impact')}</th>
                <th className="px-3 py-2">{t('form.step6.ease')}</th>
                <th className="px-3 py-2">{t('form.step6.cost')}</th>
                <th className="px-3 py-2">{t('form.step6.risk')}</th>
                <th className="px-3 py-2">{t('form.step6.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(improvement.solutions as { label: string; description: string; impact: number; ease: number; cost: number; risk: number }[]).map((s, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-bold text-blue-700">{s.label}</td>
                  <td className="px-3 py-2 text-gray-700">{s.description}</td>
                  <td className="px-3 py-2 text-center">{s.impact}</td>
                  <td className="px-3 py-2 text-center">{s.ease}</td>
                  <td className="px-3 py-2 text-center">{s.cost}</td>
                  <td className="px-3 py-2 text-center">{s.risk}</td>
                  <td className="px-3 py-2 text-center font-bold text-blue-700">{s.impact + s.ease + s.cost + s.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {improvement.chosen_solution && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs font-bold text-green-700 uppercase mb-1">{t('form.step6.chosenSolution')}</p>
            <p className="text-sm text-gray-700">{improvement.chosen_solution}</p>
          </div>
        )}
      </Section>

      {/* Before / After Images */}
      {((improvement.before_images as string[]).length > 0 || (improvement.after_images as string[]).length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['before_images', 'after_images'] as const).map(key => (
            (improvement[key] as string[]).length > 0 && (
              <Section key={key} title={t(`form.step8.${key === 'before_images' ? 'before' : 'after'}`)}>
                <div className="grid grid-cols-2 gap-2">
                  {(improvement[key] as string[]).map((url, i) => (
                    <img key={i} src={url} alt="" className="w-full h-32 object-cover rounded-lg" />
                  ))}
                </div>
              </Section>
            )
          ))}
        </div>
      )}

      {/* Results */}
      <Section title={t('form.step9.title')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-3 py-2">{t('form.step9.indicator')}</th>
                <th className="px-3 py-2">{t('form.step9.before')}</th>
                <th className="px-3 py-2">{t('form.step9.after')}</th>
                <th className="px-3 py-2">{t('form.step9.improvementPct')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(improvement.result_indicators as { name: string; before: string; after: string; improvement: string }[]).map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{r.before}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{r.after}</td>
                  <td className="px-3 py-2 text-center font-bold text-green-600">{r.improvement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(improvement.new_standards as string[]).length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">{t('form.step9.newStandards')}</p>
            <ul className="space-y-1">
              {(improvement.new_standards as string[]).map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-blue-500">✓</span>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* SQDCM Impact */}
      <Section title={t('form.step10.title')}>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {(improvement.sqdcm_impact as { category: SQDCMCategory; description: string; impact_level: ImpactLevel }[]).map(imp => (
            <div key={imp.category} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-sm flex items-center justify-center">{imp.category}</span>
                <span className="text-xs font-medium text-gray-700">{t(`sqdcm.${imp.category}`)}</span>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${IMPACT_COLORS[imp.impact_level]}`}>
                {t(`sqdcm.impact.${imp.impact_level}`)}
              </span>
              {imp.description && <p className="text-xs text-gray-500">{imp.description}</p>}
            </div>
          ))}
        </div>
      </Section>

      {/* PDCA */}
      <Section title={t('form.step11.title')}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['plan', 'do', 'check', 'act'] as const).map(phase => (
            <div key={phase} className="bg-gray-50 rounded-lg p-3">
              <p className="font-bold text-blue-700 text-xs uppercase mb-1">{phase.toUpperCase()}</p>
              <p className="text-xs text-gray-600">{improvement[`pdca_${phase}` as keyof Improvement] as string}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span><span className="font-medium text-gray-600">{t('form.step11.responsible')}:</span> {improvement.next_steps_responsible}</span>
          {improvement.next_steps_date && <span><span className="font-medium text-gray-600">{t('form.step11.commitmentDate')}:</span> {improvement.next_steps_date}</span>}
          {improvement.next_steps_followup && <span><span className="font-medium text-gray-600">{t('form.step11.followup')}:</span> {improvement.next_steps_followup}</span>}
        </div>
      </Section>

      {/* Points assigned */}
      {assignments.length > 0 && (
        <Section title={t('admin.assignPoints')}>
          <div className="flex flex-wrap gap-3">
            {assignments.map(a => (
              <div key={a.id} className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-4 py-1.5">
                <Star size={14} className="text-yellow-500" fill="currentColor" />
                <span className="text-sm font-medium text-gray-800">{a.user?.name}</span>
                <span className="text-sm font-bold text-yellow-600">{a.points} pts</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
