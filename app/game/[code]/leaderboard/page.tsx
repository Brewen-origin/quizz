'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/app/components/lib/supabase'

interface Player {
  id: string
  pseudo: string
  score: number
  is_host: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const params = useParams()
  const code = params.code as string
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [continuing, setContinuing] = useState(false)

useEffect(() => {
  async function init() {
    const playerId = localStorage.getItem('playerId')

    if (!playerId) {
      router.push('/')
      return
    }

    setMyPlayerId(playerId)

    const { data: game } = await supabase
      .from('games')
      .select('id, status')
      .eq('code', code)
      .single()

    if (!game) {
      router.push('/')
      return
    }

    setIsFinished(game.status === 'finished')

    const { data: playersData } = await supabase
      .from('players')
      .select('id, pseudo, score, is_host')
      .eq('game_id', game.id)
      .order('score', { ascending: false })

    if (playersData) {
      setPlayers(playersData)

      const me = playersData.find((p) => p.id === playerId)
      setIsHost(me?.is_host ?? false)
    }

    setLoading(false)
  }

  init()

  const channel = supabase
    .channel(`leaderboard:${code}`)
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
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'players',
    }, (payload) => {
      setPlayers((prev) =>
        prev
          .map((p) =>
            p.id === payload.new.id
              ? { ...p, score: payload.new.score }
              : p
          )
          .sort((a, b) => b.score - a.score)
      )
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [code, router])

   async function handleContinue() {
    setContinuing(true)
    try {
      const response = await fetch('/api/games/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCode: code }),
      })
      if (!response.ok) {
        throw new Error('Failed to continue game')
      }
      // Redirection via Realtime
    } catch {
      setContinuing(false)
    }
  }

  async function handleReplay() {
    // Retour home pour recréer une partie
    router.push('/home')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6 max-w-md mx-auto">

      {/* Titre */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">
          {isFinished ? '🏆 Résultats finaux' : '📊 Classement'}
        </h1>
        {!isFinished && (
          <p className="text-gray-400 text-sm mt-1">En attente de la prochaine question...</p>
        )}
      </div>

      {/* Podium top 3 — uniquement en fin de partie */}
      {isFinished && players.length >= 1 && (
        <div className="flex items-end justify-center gap-2 mb-8 h-32">
          {/* 2ème */}
          {players[1] && (
            <div className="flex flex-col items-center flex-1">
              <span className="text-2xl mb-1">🥈</span>
              <p className="text-xs text-center text-gray-300 truncate w-full text-center">
                {players[1].pseudo}
              </p>
              <div className="bg-gray-600 w-full rounded-t-xl flex items-end justify-center h-16 pt-2">
                <span className="text-sm font-bold">{players[1].score}</span>
              </div>
            </div>
          )}
          {/* 1er */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-3xl mb-1">🥇</span>
            <p className="text-xs text-center text-yellow-300 font-bold truncate w-full text-center">
              {players[0].pseudo}
            </p>
            <div className="bg-yellow-600 w-full rounded-t-xl flex items-end justify-center h-24 pt-2">
              <span className="text-sm font-bold">{players[0].score}</span>
            </div>
          </div>
          {/* 3ème */}
          {players[2] && (
            <div className="flex flex-col items-center flex-1">
              <span className="text-2xl mb-1">🥉</span>
              <p className="text-xs text-center text-gray-300 truncate w-full text-center">
                {players[2].pseudo}
              </p>
              <div className="bg-orange-800 w-full rounded-t-xl flex items-end justify-center h-10 pt-2">
                <span className="text-sm font-bold">{players[2].score}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Classement complet */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden mb-6">
        {players.map((player, index) => {
          const isMe = player.id === myPlayerId
          return (
            <div
              key={player.id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0 ${
                isMe ? 'bg-indigo-900/40' : ''
              }`}
            >
              {/* Rang */}
              <span className="text-lg w-8 text-center">
                {index < 3 ? MEDALS[index] : `${index + 1}.`}
              </span>

              {/* Pseudo */}
              <span className={`flex-1 font-medium ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                {player.pseudo}
                {isMe && <span className="text-xs text-indigo-400 ml-2">(toi)</span>}
                {player.is_host && <span className="text-xs text-yellow-500 ml-2">👑</span>}
              </span>

              {/* Score */}
              <span className="font-bold text-yellow-400">{player.score} pts</span>
            </div>
          )
        })}
      </div>

      {/* Boutons */}
      {isFinished ? (
        <div className="flex flex-col gap-3">
          {isHost && (
            <button
              onClick={handleReplay}
              className="bg-indigo-600 hover:bg-indigo-500 rounded-2xl py-4 font-bold text-lg active:scale-95 transition-all"
            >
              🔄 Rejouer
            </button>
          )}
          <button
            onClick={() => router.push('/home')}
            className="bg-gray-800 hover:bg-gray-700 rounded-2xl py-4 font-bold text-lg active:scale-95 transition-all"
          >
            🏠 Retour accueil
          </button>
        </div>
      ) : (
        isHost ? (
          <button
            onClick={handleContinue}
            disabled={continuing}
            className="bg-green-600 hover:bg-green-500 rounded-2xl py-5 font-bold text-xl active:scale-95 transition-all disabled:opacity-50"
          >
            {continuing ? 'Chargement...' : 'Continuer →'}
          </button>
        ) : (
          <div className="text-center text-gray-400 text-sm">
            En attente du host...
          </div>
        )
      )}
    </main>
  )
}