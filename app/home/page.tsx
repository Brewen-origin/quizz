'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [pseudo, setPseudo] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'home' | 'join'>('home')

  useEffect(() => {
    // Récupérer le pseudo stocké
    const storedPseudo = localStorage.getItem('pseudo')
    if (!storedPseudo) {
      router.push('/') // pas de pseudo : retour accueil
      return
    }
    setPseudo(storedPseudo)
  }, [router])

  //  Créer une partie 
  async function handleCreate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/games/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      localStorage.setItem('playerId', data.playerId)
      localStorage.setItem('gameCode', data.gameCode)
      router.push(`/lobby/${data.gameCode}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur création partie')
    } finally {
      setLoading(false)
    }
  }

  //  Rejoindre une partie 
  async function handleJoin() {
    if (!joinCode.trim()) {
      setError('Entre un code de partie')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/games/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.toUpperCase(), pseudo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      localStorage.setItem('playerId', data.playerId)
      localStorage.setItem('gameCode', joinCode.toUpperCase())
      router.push(`/lobby/${joinCode.toUpperCase()}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur rejoindre partie')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-2">Bienvenue, {pseudo} 👋</h1>
      <p className="text-gray-400 mb-10">Que veux-tu faire ?</p>

      {error && (
        <div className="bg-red-900/50 text-red-300 rounded-xl px-4 py-3 mb-6 w-full max-w-sm text-center">
          {error}
        </div>
      )}

      {view === 'home' && (
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all rounded-2xl py-5 text-xl font-bold disabled:opacity-50"
          >
            {loading ? 'Création...' : '🎮 Créer une partie'}
          </button>
          <button
            onClick={() => setView('join')}
            className="bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-2xl py-5 text-xl font-bold"
          >
            🔗 Rejoindre une partie
          </button>
        </div>
      )}

      {view === 'join' && (
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <input
            type="text"
            placeholder="Code de la partie"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="bg-gray-800 rounded-2xl px-4 py-4 text-center text-2xl font-mono tracking-widest outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleJoin}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all rounded-2xl py-5 text-xl font-bold disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Rejoindre'}
          </button>
          <button
            onClick={() => { setView('home'); setError('') }}
            className="text-gray-400 py-3"
          >
            ← Retour
          </button>
        </div>
      )}
    </main>
  )
}