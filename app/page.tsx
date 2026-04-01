'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'

// ── Composant séparé pour useSearchParams ────────────────────────────────────
function SessionLostBanner() {
  const searchParams = useSearchParams()
  const sessionLost = searchParams.get('error') === 'session_perdue'

  if (!sessionLost) return null

  return (
    <div className="bg-orange-900/50 text-orange-300 rounded-xl px-4 py-3 mb-4 text-center text-sm">
      Session expirée — reconnecte-toi
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pseudo, setPseudo] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pseudo') || ''
    }
    return ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== 'piriac') {
      setError('Mot de passe incorrect')
      return
    }
    if (!pseudo.trim()) {
      setError('Veuillez saisir un pseudo')
      return
    }

    localStorage.removeItem('playerId')
    localStorage.removeItem('gameCode')
    localStorage.setItem('pseudo', pseudo.trim())
    router.push('/home')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4">
      <h1 className="text-2xl font-bold mb-6">Bienvenue au Quiz !</h1>

      {/* Suspense obligatoire autour de useSearchParams */}
      <Suspense fallback={null}>
        <SessionLostBanner />
      </Suspense>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col w-full max-w-sm gap-4 bg-gray-900 p-6 rounded-2xl"
      >
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="••••••"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Pseudo</label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full bg-gray-800 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ton pseudo"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold active:scale-95 transition-all"
        >
          Continuer →
        </button>
      </form>
    </div>
  )
}