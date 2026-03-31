import { supabase } from '@/app/components/lib/supabase'
import { NextResponse } from 'next/server'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

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
    if (!data) return code
    code = generateCode()
    attempts++
  }
  throw new Error('Impossible de générer un code unique')
}

export async function POST(request: Request) {
  try {
    const { pseudo } = await request.json()

    if (!pseudo?.trim()) {
      return NextResponse.json({ error: 'Pseudo requis' }, { status: 400 })
    }

    const code = await generateUniqueCode()

    // Créer la partie sans questions ni config — juste le lobby
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        code,
        status: 'lobby',
        question_ids: [],
        current_question_index: 0,
        question_count: 10,   // valeur par défaut modifiable dans le lobby
        themes: [],
      })
      .select('id')
      .single()

    if (gameError || !game) {
      console.error('Erreur création game:', gameError)
      return NextResponse.json({ error: 'Erreur création partie' }, { status: 500 })
    }

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
      await supabase.from('games').delete().eq('id', game.id)
      return NextResponse.json({ error: 'Erreur création joueur' }, { status: 500 })
    }

    return NextResponse.json({ gameCode: code, playerId: player.id })

  } catch (error) {
    console.error('[/api/games/create]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}