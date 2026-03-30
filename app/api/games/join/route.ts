import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, pseudo } = body

    // Validation basique 
    if (!code || !pseudo?.trim()) {
      return NextResponse.json({ error: 'Code et pseudo requis' }, { status: 400 })
    }

    // Trouver la partie 
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, status')
      .eq('code', code.toUpperCase())
      .single()

    if (gameError || !game) {
      return NextResponse.json({ error: 'Partie introuvable' }, { status: 404 })
    }

    // Vérifier le statut 
    if (game.status !== 'lobby') {
      return NextResponse.json({ error: 'La partie a déjà commencé' }, { status: 400 })
    }

    // Récupérer les joueurs existants 
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('id, pseudo')
      .eq('game_id', game.id)

    // Vérifier limite 10 joueurs 
    if (existingPlayers && existingPlayers.length >= 10) {
      return NextResponse.json({ error: 'La partie est pleine (max 10 joueurs)' }, { status: 400 })
    }

    // Vérifier pseudo unique dans la partie 
    const pseudoTaken = existingPlayers?.some(
      (p) => p.pseudo.toLowerCase() === pseudo.trim().toLowerCase()
    )
    if (pseudoTaken) {
      return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 400 })
    }

    // Créer le joueur
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        pseudo: pseudo.trim(),
        game_id: game.id,
        is_host: false,
        score: 0,
        connected: true,
      })
      .select('id')
      .single()

    if (playerError || !player) {
      console.error('Erreur création joueur:', playerError)
      return NextResponse.json({ error: 'Erreur création joueur' }, { status: 500 })
    }

    // Réponse 
    return NextResponse.json({
      playerId: player.id,
      gameId: game.id,
    })

  } catch (error) {
    console.error('[/api/games/join]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}