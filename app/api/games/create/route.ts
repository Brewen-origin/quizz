import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Génère un code 6 lettres majuscules
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sans I et O pour éviter confusion askip
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

// Génère un code unique (on check la collision en DB)
async function generateUniqueCode(): Promise<string> {
  let code = generateCode()
  let attempts = 0

  while (attempts < 10) {
    const { data } = await supabase
  .from('games')
  .select('id')
  .eq('code', code)
  .in('status', ['lobby', 'playing', 'paused'])
  .single()

    if (!data) return code // code libre : on le prend

    code = generateCode() // collision : on réessaie
    attempts++
  }

  throw new Error('Impossible de générer un code unique après 10 tentatives')
}

// Mélange un tableau (Fisher-Yates)
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
    const body = await request.json()
    const { pseudo, themes, questionCount } = body

    // Validation basique
    if (!pseudo || typeof pseudo !== 'string' || pseudo.trim() === '') {
      return NextResponse.json({ error: 'Pseudo requis' }, { status: 400 })
    }
    if (!questionCount || questionCount < 1) {
      return NextResponse.json({ error: 'questionCount invalide' }, { status: 400 })
    }

    // Sélection des questions
    let query = supabase.from('questions').select('id')

    // Filtrer par thèmes si fournis et non vides
    if (themes && themes.length > 0) {
      query = query.in('theme', themes)
    }

    const { data: allQuestions, error: questionsError } = await query

    if (questionsError) {
      return NextResponse.json({ error: 'Erreur récupération questions' }, { status: 500 })
    }

    // Pas assez de questions disponibles
    if (!allQuestions || allQuestions.length < questionCount) {
      return NextResponse.json(
        {
          error: `Pas assez de questions disponibles. Demandé : ${questionCount}, disponible : ${allQuestions?.length ?? 0}`,
        },
        { status: 400 }
      )
    }

    // Mélanger et prendre N questions
    const selectedIds = shuffle(allQuestions)
      .slice(0, questionCount)
      .map((q) => q.id)

    // Génération du code lobby
    const code = await generateUniqueCode()

    // Création de la partie
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        code,
        status: 'lobby',
        question_ids: selectedIds,
        current_question_index: 0,
        question_count: questionCount,
        themes: themes ?? [],
      })
      .select('id')
      .single()

    if (gameError || !game) {
  console.error('Erreur Supabase games:', gameError) 
      return NextResponse.json({ error: 'Erreur création partie' }, { status: 500 })
    }

    // Création du joueur host
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        pseudo: pseudo.trim(),
        game_id: game.id,
        is_host: true,
        score: 0,
        connected: true,
      })
      .select('id')
      .single()

    if (playerError || !player) {
      // Rollback
      await supabase.from('games').delete().eq('id', game.id)
      return NextResponse.json({ error: 'Erreur création joueur' }, { status: 500 })
    }

    // Réponse 
    return NextResponse.json({
      gameCode: code,
      playerId: player.id,
    })

  } catch (error) {
    console.error('[/api/games/create]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}