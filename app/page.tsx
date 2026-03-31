'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState('')

  // Si pseudo déjà dans localStorage, rediriger vers /home
  useEffect(() => {
    const savedPseudo = localStorage.getItem('pseudo')
    if (savedPseudo) {
      router.push('/home')
    }
  }, [router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Vérification mot de passe
    if (password !== 'piriac') {
      setError('Mot de passe incorrect')
      return
    }

    // Vérification pseudo
    if (!pseudo.trim()) {
      setError('Veuillez saisir un pseudo')
      return
    }

    localStorage.removeItem('playerId')
    localStorage.removeItem('gameCode')
    // Sauvegarde localStorage
    localStorage.setItem('pseudo', pseudo.trim())
    localStorage.setItem('playerId', '') // temporaire, rempli après create/join
    localStorage.setItem('gameCode', '')

    router.push('/home')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-6">Bienvenue au Quiz !</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col w-full max-w-sm gap-4 bg-white p-6 rounded-xl shadow-md"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Mot de passe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Pseudo</label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Votre pseudo"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Continuer
        </button>
      </form>
    </div>
  )
}