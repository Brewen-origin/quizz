import { NextResponse } from 'next/server'
import { supabase } from '@/app/components/lib/supabase'

export async function POST(request: Request) {
  try {
    const { gameCode } = await request.json()

    // Validate input 
    if (!gameCode) {
      return NextResponse.json(
        { error: 'Missing fields' },
        { status: 400 }
      )
    }

    // Get game 
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, current_question_index, question_count')
      .eq('code', gameCode)
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    // Check host 
    const { data: host } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', game.id)
      .eq('is_host', true)
      .single()

    if (!host) {
      return NextResponse.json({ error: 'No host found for this game' }, { status: 403 })
    }

    const nextIndex = game.current_question_index + 1

    // End of game 
    if (nextIndex >= game.question_count) {
      const { error } = await supabase
        .from('games')
        .update({
          status: 'finished',
          current_question_index: nextIndex,
        })
        .eq('id', game.id)
        // race condition protection
        .eq('current_question_index', game.current_question_index)

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ status: 'finished' })
    }

    // Leaderboard every 5 questions 
    if (nextIndex % 5 === 0) {
      const { error } = await supabase
        .from('games')
        .update({
          status: 'leaderboard',
          current_question_index: nextIndex,
        })
        .eq('id', game.id)
        .eq('current_question_index', game.current_question_index)

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ status: 'leaderboard' })
    }

    // Next question 
    const { error } = await supabase
      .from('games')
      .update({
        status: 'playing',
        current_question_index: nextIndex,
        question_started_at: new Date().toISOString(),
      })
      .eq('id', game.id)
      .eq('current_question_index', game.current_question_index)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: 'playing' })

  } catch (error) {
    console.error('[/api/games/next-question]', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}