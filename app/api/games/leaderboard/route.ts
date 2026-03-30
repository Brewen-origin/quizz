import { NextResponse } from 'next/server'
import { supabase } from '@/app/components/lib/supabase'

export async function POST(req: Request) {
  try {
    const { gameId } = await req.json()

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })
    }

    // Get scores
    const { data: scores, error } = await supabase
      .from('answers')
      .select('player_id, points')
      .eq('game_id', gameId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Agrégation côté serveur - à améliorer plus tard mdr
    const scoreMap: Record<string, number> = {}

    scores.forEach((row) => {
      if (!scoreMap[row.player_id]) {
        scoreMap[row.player_id] = 0
      }
      scoreMap[row.player_id] += row.points
    })

    // Get pseudos
    const { data: players } = await supabase
      .from('players')
      .select('id, pseudo')
      .eq('game_id', gameId)

    const leaderboard = (players || []).map((p) => ({
        playerId: p.id,
        pseudo: p.pseudo,
        score: scoreMap[p.id] || 0,
    }))

    // Tri
    leaderboard.sort((a, b) => b.score - a.score)

    return NextResponse.json({ leaderboard })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}