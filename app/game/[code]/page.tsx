'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/components/lib/supabase'

interface GameState {
  id: string
  code: string
  status: string
  current_question_index: number
  // ajoute tes autres champs ici
}

export default function GamePage({ params }: { params: { code: string } }) {
  const { code } = params
  const [gameState, setGameState] = useState<GameState | null>(null)

  useEffect(() => {
    // 1. Charger l'état initial
    const fetchGame = async () => {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .single()
      if (data) setGameState(data)
    }
    fetchGame()

    // 2. S'abonner aux changements
    const channel = supabase
      .channel(`game:${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `code=eq.${code}`,
        },
        (payload) => {
          setGameState(payload.new as GameState)
        }
      )
      .subscribe()

    // 3. Cleanup au démontage
    return () => {
      supabase.removeChannel(channel)
    }
  }, [code])

  if (!gameState) return <div>Chargement...</div>

  return <div>Partie : {gameState.status}</div>
}