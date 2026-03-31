'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const THEMES = ['culture', 'sport', 'histoire', 'science']
// Ajoute ici les thèmes que tu as dans ta DB

interface Player {
  id: string
  pseudo: string
  is_host: boolean
}

export default function LobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const playerId = localStorage.getItem('playerId')
    if (!playerId) {
      router.push('/')
      return
    }

    //  Charger les joueurs initiaux + détecter si on est host 
    async function init() {
      const { data: game } = await supabase
        .from('games')
        .select('id, status')
        .eq('code', code)
        .single()

      if (!game) { router.push('/'); return }

      // Si la partie a déjà démarré (refresh pendant le jeu)
      if (game.status === 'playing') {
        router.push(`/game/${code}`)
        return
      }

      const { data: playersData } = await supabase
        .from('players')
        .select('id, pseudo, is_host')
        .eq('game_id', game.id)

      if (playersData) {
        setPlayers(playersData)
        const me = playersData.find((p) => p.id === playerId)
        setIsHost(me?.is_host ?? false)
      }
    }

    init()

    //  Realtime : nouveaux joueurs 
    const playersChannel = supabase
      .channel(`lobby-players:${code}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
      }, (payload) => {
        setPlayers((prev) => [...prev, payload.new as Player])
      })
      .subscribe()

    //  Realtime : lancement de la partie 
    const gameChannel = supabase
      .channel(`lobby-game:${code}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `code=eq.${code}`,
      }, (payload) => {
        if (payload.new.status === 'playing') {
          router.push(`/game/${code}`)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(playersChannel)
      supabase.removeChannel(gameChannel)
    }
  }, [code, router])

  //  Toggle thème 
  function toggleTheme(theme: string) {
    setSelectedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
    )
  }

  //  Lancer la partie 
  async function handleStart() {
    if (questionCount < 1) {
      setError('Choisis au moins 1 question')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/games/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameCode: code,
          themes: selectedThemes,     // [] = toutes les thèmes
          questionCount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // La redirection se fait automatiquement via le Realtime ci-dessus
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lancement')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6 max-w-md mx-auto">

      {/* Code lobby */}
      <div className="text-center mb-8">
        <p className="text-gray-400 text-sm mb-1">Code de la partie</p>
        <div className="text-5xl font-mono font-bold tracking-widest text-indigo-400">
          {code}
        </div>
      </div>

      {/* Liste des joueurs */}
      <div className="bg-gray-900 rounded-2xl p-4 mb-6">
        <h2 className="text-gray-400 text-sm mb-3">
          Joueurs ({players.length}/10)
        </h2>
        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="text-lg">{p.is_host ? '👑' : '🎮'}</span>
              <span className="font-medium">{p.pseudo}</span>
              {p.is_host && (
                <span className="ml-auto text-xs text-indigo-400">Host</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Config — host uniquement */}
      {isHost ? (
        <div className="flex flex-col gap-6">

          {/* Thèmes */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <h2 className="text-gray-400 text-sm mb-3">
              Thèmes{' '}
              <span className="text-gray-600">
                (aucun sélectionné = tous)
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  onClick={() => toggleTheme(theme)}
                  className={`rounded-xl py-3 text-sm font-medium transition-all active:scale-95 ${
                    selectedThemes.includes(theme)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre de questions */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <h2 className="text-gray-400 text-sm mb-3">
              Nombre de questions : <span className="text-white font-bold">{questionCount}</span>
            </h2>
            <input
              type="range"
              min={5}
              max={20}
              step={5}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5</span><span>10</span><span>15</span><span>20</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/50 text-red-300 rounded-xl px-4 py-3 text-center text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading || players.length < 1}
            className="bg-green-600 hover:bg-green-500 active:scale-95 transition-all rounded-2xl py-5 text-xl font-bold disabled:opacity-50"
          >
            {loading ? 'Lancement...' : '🚀 Lancer la partie'}
          </button>
        </div>

      ) : (
        // Vue joueur — lecture seule
        <div className="bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-gray-400 text-sm">En attente du host...</p>
          <div className="mt-4 flex justify-center gap-1">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0ms]"/>
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:150ms]"/>
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:300ms]"/>
          </div>
        </div>
      )}
    </main>
  )
}