import { NextResponse } from 'next/server'
import { supabase } from '@/app/components/lib/supabase'

function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function POST(request: Request) {
  try {
    const { gameCode, themes, questionCount, questionDuration } = await request.json()
    const parsedQuestionDuration = questionDuration == null ? 15 : Number(questionDuration)
    if (!gameCode || !questionCount) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }
     if (
      !Number.isInteger(parsedQuestionDuration) ||
      parsedQuestionDuration < 10 ||
      parsedQuestionDuration > 30 ||
      parsedQuestionDuration % 5 !== 0
    ) {
      return NextResponse.json({ error: 'Durée invalide' }, { status: 400 })
    }

    

    // Vérifier que la partie existe et est en lobby
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, status')
      .eq('code', gameCode)
      .single()

    if (gameError || !game) {
      return NextResponse.json({ error: 'Partie introuvable' }, { status: 404 })
    }
    if (game.status !== 'lobby') {
      return NextResponse.json({ error: 'La partie a déjà commencé' }, { status: 400 })
    }

    // Sélectionner les questions
    let query = supabase.from('questions').select('id')
    if (themes && themes.length > 0) {
      query = query.in('theme', themes)
    }
    const { data: allQuestions } = await query

    if (!allQuestions || allQuestions.length < questionCount) {
      return NextResponse.json(
        { error: `Pas assez de questions (${allQuestions?.length ?? 0} dispo pour ${questionCount} demandées)` },
        { status: 400 }
      )
    }

    const selectedIds = shuffle(allQuestions)
      .slice(0, questionCount)
      .map((q) => q.id)

    // Mettre à jour la partie et lancer
    const { error: updateError } = await supabase
      .from('games')
      .update({
        status: 'playing',
        question_ids: selectedIds,
        question_count: questionCount,
        question_duration: parsedQuestionDuration,
        themes: themes ?? [],
        current_question_index: 0,
        question_started_at: new Date().toISOString(),
      })
      .eq('id', game.id)

    if (updateError) {
      console.error('Erreur lancement:', updateError)
      return NextResponse.json({ error: 'Erreur lancement partie' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[/api/games/start]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}