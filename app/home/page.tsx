'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [themes, setThemes] = useState<string[]>(['General'])
  const [questionCount, setQuestionCount] = useState(5)
  const [error, setError] = useState('')
  const [pseudo, setPseudo] = useState<string | null>(null) 

  // Lecture localStorage côté client
  useEffect(() => {
    const savedPseudo = localStorage.getItem('pseudo')
    if (!savedPseudo) {
      router.push('/') 
    } else {
      setPseudo(savedPseudo)
    }
  }, [router])

  if (!pseudo) return null 

  // --- CREATE GAME ---
  const handleCreate = async () => {
    setError('')
    try {
      const res = await fetch('/api/games/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pseudo,
          themes,
          questionCount,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur création partie')
        return
      }

      localStorage.setItem('playerId', data.playerId)
      localStorage.setItem('gameCode', data.gameCode)
      router.push(`/lobby/${data.gameCode}`)
    } catch (err) {
      console.error(err)
      setError('Erreur serveur')
    }
  }

  // --- JOIN GAME ---
  const handleJoin = async () => {
    setError('')
    if (!joinCode.trim()) {
      setError('Veuillez saisir un code')
      return
    }

    try {
      const res = await fetch('/api/games/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase(), pseudo }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur rejoindre partie')
        return
      }

      localStorage.setItem('playerId', data.playerId)
      localStorage.setItem('gameCode', joinCode.trim().toUpperCase())
      router.push(`/lobby/${joinCode.trim().toUpperCase()}`)
    } catch (err) {
      console.error(err)
      setError('Erreur serveur')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 gap-6">
      <h1 className="text-2xl font-bold mb-4">Bonjour {pseudo}</h1>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* --- CREATE GAME --- */}
      <div className="w-full max-w-sm bg-white p-6 rounded-xl shadow-md flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Créer une partie</h2>

        <label className="text-sm font-medium">Nombre de questions</label>
        <input
          type="number"
          min={1}
          max={20}
          value={questionCount}
          onChange={(e) => setQuestionCount(Number(e.target.value))}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <button
          onClick={handleCreate}
          className="mt-2 bg-green-500 text-white py-2 rounded hover:bg-green-600"
        >
          Créer
        </button>
      </div>

      {/* --- JOIN GAME --- */}
      <div className="w-full max-w-sm bg-white p-6 rounded-xl shadow-md flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Rejoindre une partie</h2>

        <input
          type="text"
          maxLength={6}
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Code lobby"
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
        />

        <button
          onClick={handleJoin}
          className="mt-2 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          Rejoindre
        </button>
      </div>
    </div>
  )
}