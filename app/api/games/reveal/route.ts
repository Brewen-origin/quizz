import { NextResponse } from 'next/server'
import { supabase } from '@/app/components/lib/supabase'

export async function POST(request: Request) {
  try {
    const { gameCode } = await request.json()
    await supabase
      .from('games')
      .update({ status: 'revealing' })
      .eq('code', gameCode)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}