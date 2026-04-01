'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/components/lib/supabase'

//  Types 

export interface Game {
  id: string
  code: string
  status: 'lobby' | 'playing' | 'revealing' | 'leaderboard' | 'finished' | 'paused'
  current_question_index: number
  question_count: number
  question_ids: string[]
  question_started_at: string
  question_duration: number
  themes: string[]
}

export interface Player {
  id: string
  pseudo: string
  score: number
  is_host: boolean
  connected: boolean
}

export interface Question {
  id: string
  type: string
  question: string
  choices: string[]
  answer: string
  difficulty: number
  theme: string
  image: string | null
}

export interface UseGameReturn {
  game: Game | null
  players: Player[]
  currentQuestion: Question | null
  myPlayer: Player | null
  hasAnswered: boolean      // joueur a déjà répondu à la question courante
  loading: boolean
  error: string | null
}

//  Hook principal 

export function useGame(code: string): UseGameReturn {
  const router = useRouter()

  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [myPlayer, setMyPlayer] = useState<Player | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Ref pour éviter les requêtes question obsolètes
  const currentQuestionIdRef = useRef<string | null>(null)
  // Ref pour éviter les double-subscriptions en StrictMode
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  //  Charger la question courante 
  async function fetchQuestion(questionId: string) {
    if (!questionId) return
    currentQuestionIdRef.current = questionId

    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()

    // Ignorer si une question plus récente a été demandée
    if (currentQuestionIdRef.current !== questionId) return
    if (data) setCurrentQuestion(data)
  }

  //  Vérifier si le joueur a déjà répondu à la question courante 
  async function checkHasAnswered(playerId: string|null, questionId: string) {
    if (!playerId || !questionId) return

    const { data } = await supabase
      .from('answers')
      .select('id')
      .eq('player_id', playerId)
      .eq('question_id', questionId)
      .maybeSingle()

    setHasAnswered(!!data)
  }

  useEffect(() => {
    // Lire playerId depuis localStorage 
    const playerId = localStorage.getItem('playerId')

    if (!playerId) {
      router.push('/?error=session_perdue')
      return
    }

    // Init : fetch état complet de la partie 
    async function init() {
      try {
        // Fetch game
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('code', code)
          .single()

        if (gameError || !gameData) {
          setError('Partie introuvable')
          router.push('/home')
          return
        }

        // Fetch players
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameData.id)
          .order('score', { ascending: false })

        const playersList = playersData ?? []
        setPlayers(playersList)

        // Identifier myPlayer
        const me = playersList.find((p) => p.id === playerId) ?? null
        setMyPlayer(me)

        // Joueur introuvable ou supprimé
        if (!me) {
          setError('Joueur introuvable')
          router.push('/home')
          return
        }

        // Reconnexion — marquer connected = true 
        await supabase
          .from('players')
          .update({ connected: true, last_seen: new Date().toISOString() })
          .eq('id', playerId)

        setGame(gameData)

        // Charger la question courante si en jeu 
        const activeStatuses = ['playing', 'revealing']
        if (
          activeStatuses.includes(gameData.status) &&
          gameData.question_ids?.length > 0
        ) {
          const questionId = gameData.question_ids[gameData.current_question_index]
          await fetchQuestion(questionId)
          await checkHasAnswered(playerId, questionId)
        }

        //  Redirection selon status au refresh 
        // (géré dans les pages qui consomment le hook)
        // On expose game.status -> la page décide

        setLoading(false)
      } catch (err) {
        console.error('[useGame] init error:', err)
        setError('Erreur de chargement')
        setLoading(false)
      }
    }

    init()

    // Subscriptions Realtime 

    // Éviter double subscription (React StrictMode monte deux fois)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`use-game:${code}`)

      // Subscription game
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `code=eq.${code}`,
      }, async (payload) => {
        const updated = payload.new as Game
        setGame(updated)

        // Nouvelle question -> charger
        if (
          updated.status === 'playing' &&
          updated.question_ids?.length > 0
        ) {
          const questionId = updated.question_ids[updated.current_question_index]
          await fetchQuestion(questionId)
          await checkHasAnswered(playerId, questionId)
        }
      })

      // Subscription players - INSERT (nouveau joueur)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
      }, (payload) => {
        const newPlayer = payload.new as Player
        setPlayers((prev) => {
          // Éviter les doublons
          if (prev.find((p) => p.id === newPlayer.id)) return prev
          return [...prev, newPlayer].sort((a, b) => b.score - a.score)
        })
      })

      // Subscription players -UPDATE (score, connected...)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'players',
      }, (payload) => {
        const updated = payload.new as Player
        setPlayers((prev) =>
          prev
            .map((p) => p.id === updated.id ? updated : p)
            .sort((a, b) => b.score - a.score)
        )
        // Mettre à jour myPlayer si c'est nous
        if (updated.id === playerId) {
          setMyPlayer(updated)
        }
      })

      .subscribe()

    channelRef.current = channel

    // Cleanup propre au unmount 
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [code]) //  pas router dans les deps, ça causerait des re-renders

  return { game, players, currentQuestion, myPlayer, hasAnswered, loading, error }
}