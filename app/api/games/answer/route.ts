import { NextResponse } from 'next/server'
import { supabase } from '@/app/components/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { gameId, playerId, questionId, answer } = body

    // Validation
    if (!gameId || !playerId || !questionId || answer === undefined) {
      return NextResponse.json(
        { error: 'Missing fields' },
        { status: 400 }
      )
    }

    // Vérifier si déjà répondu
    const { data: existing } = await supabase
      .from('answers')
      .select('id')
      .eq('player_id', playerId)
      .eq('question_id', questionId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Already answered' },
        { status: 400 }
      )
    }

    // Récupérer la question
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Calcul résultat
    let isCorrect = false

    if (question.type === 'estimation') {
      const correctValue = Number(question.answer)
      const userValue = Number(answer)

      if (!isNaN(userValue)) {
        const tolerance = correctValue * 0.1 // A + ou - 10% ? ptet à gérer selon la question direct avec un champ?
        isCorrect =
          userValue >= correctValue - tolerance &&
          userValue <= correctValue + tolerance
      }
    } else {
      isCorrect = String(answer) === String(question.answer)
    }

    // Points 
    //TODO gérer la rapidité de réponse ?
    const points = isCorrect ? question.difficulty * 100 : 0

    // Insert réponse
    const { error: insertError } = await supabase
      .from('answers')
      .insert({
        game_id: gameId,
        player_id: playerId,
        question_id: questionId,
        answer_value: String(answer),
        is_correct: isCorrect,
        points,
        answered_at: new Date().toISOString(),
      })

    if (insertError) {
      // sécurité race condition (unique constraint)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Already answered (race)' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      isCorrect,
      points,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}