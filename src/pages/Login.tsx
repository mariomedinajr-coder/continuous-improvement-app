import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TrendingUp, LogIn, AlertCircle, Globe } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { t, i18n } = useTranslation()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const toggleLang = () => {
    const next = i18n.language === 'es' ? 'en' : 'es'
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('Invalid') ? t('auth.invalidCredentials') : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 relative">
      <button
        onClick={toggleLang}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/80 text-sm text-gray-600 hover:bg-white shadow-sm border border-gray-200"
      >
        <Globe size={14} />
        {i18n.language === 'es' ? 'English' : 'Español'}
      </button>

      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
            <TrendingUp size={22} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg leading-tight">
            Mejora<br/>Continua
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('auth.signInTitle')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('auth.signInSubtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <LogIn size={16} />
            {loading ? t('common.loading') : t('auth.signInButton')}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          {t('auth.contactAdmin')}
        </p>
      </div>
    </div>
  )
}
