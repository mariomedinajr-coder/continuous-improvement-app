import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Award } from '../types'

export default function Awards() {
  const { t } = useTranslation()
  const [awards, setAwards] = useState<Award[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('awards')
        .select('*')
        .eq('active', true)
        .order('point_cost', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setAwards((data ?? []) as Award[])
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('awards.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('awards.subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-500">
          {t('common.loading')}
        </div>
      ) : awards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
          <Gift size={32} className="text-gray-300 mb-2" />
          {t('awards.noAwards')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {awards.map((award) => {
            const outOfStock = award.stock !== null && award.stock <= 0
            return (
              <div
                key={award.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col"
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                  {award.image_url ? (
                    <img
                      src={award.image_url}
                      alt={award.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Gift size={40} className="text-gray-300" />
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                      {award.name}
                    </h3>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                      {award.point_cost} {t('common.points').toLowerCase()}
                    </span>
                  </div>
                  {award.description && (
                    <p className="text-sm text-gray-500 line-clamp-3 flex-1">
                      {award.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Package size={13} />
                      {award.stock === null ? (
                        <span>{t('awards.unlimited')}</span>
                      ) : outOfStock ? (
                        <span className="font-medium text-red-600">{t('awards.outOfStock')}</span>
                      ) : (
                        <span>
                          {t('awards.stock')}: <span className="font-medium text-gray-700">{award.stock}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
