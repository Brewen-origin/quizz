import { NextResponse } from 'next/server'
import { supabase } from '@/app/components/lib/supabase'

export async function POST(req: Request) {
  try {
    const { gameId, playerId } = await req.json()

    if (!gameId || !playerId) {
      return NextResponse.json(
        { error: 'Missing fields' },
        { status: 400 }
      )
    }

    // Vérifier que le joueur est host
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('is_host')
      .eq('id', playerId)
      .eq('game_id', gameId)
      .single()

    if (playerError || !player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      )
    }

    if (!player.is_host) {
      return NextResponse.json(
        { error: 'Only host can proceed' },
        { status: 403 }
      )
    }

    // Récupérer la game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    const nextIndex = game.current_question_index + 1

    // Vérifier fin de partie
    if (nextIndex >= game.question_count) {
      const { error: updateError } = await supabase
        .from('games')
        .update({
          status: 'finished',
        })
        .eq('id', gameId)

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        finished: true,
      })
    }

    // Passer à la question suivante
    const { error: updateError } = await supabase
      .from('games')
      .update({
        current_question_index: nextIndex,
        question_started_at: new Date().toISOString(),
        status: 'playing',
      })
      .eq('id', gameId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      nextIndex,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}