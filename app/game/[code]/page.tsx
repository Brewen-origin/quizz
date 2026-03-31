'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Timer from '@/app/components/Timer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Question {
  id: string
  type: string
  question: string
  choices: string[]
  answer: string
  difficulty: number
  theme: string
  image: string | null
}

interface Game {
  id: string
  status: string
  current_question_index: number
  question_count: number
  question_ids: string[]
  question_started_at: string
  question_duration: number
}

export default function GamePage() {
  const params = useParams()
  const code = params.code as string
  const router = useRouter()

  const [game, setGame] = useState<Game | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [answered, setAnswered] = useState(false)
  const [loading, setLoading] = useState(true)

  // Charger la question depuis son ID
  async function fetchQuestion(questionId: string) {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()
    if (data) setQuestion(data)
  }

  // Charger la partie + question initiale
  async function fetchGame() {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .single()

    if (!data) { router.push('/'); return }

    if (data.status === 'finished') { router.push(`/game/${code}/leaderboard`); return }

    setGame(data)
    setAnswered(false)
    await fetchQuestion(data.question_ids[data.current_question_index])
    setLoading(false)
  }
useEffect(() => {
  const playerId = localStorage.getItem('playerId')
  if (!playerId) { router.push('/'); return }

  async function init() {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .single()

    if (!data) { router.push('/'); return }
    if (data.status === 'finished') { router.push(`/game/${code}/leaderboard`); return }

    setGame(data)
    setAnswered(false)

    const { data: q } = await supabase
      .from('questions')
      .select('*')
      .eq('id', data.question_ids[data.current_question_index])
      .single()

    if (q) setQuestion(q)
    setLoading(false)
  }

  init() // ← appel propre, pas de cascade

  const channel = supabase
    .channel(`game:${code}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'games',
      filter: `code=eq.${code}`,
    }, async (payload) => {
      const updated = payload.new as Game
      if (updated.status === 'finished') {
        router.push(`/game/${code}/leaderboard`)
        return
      }
      if (updated.status === 'playing') {
        setGame(updated)
        setAnswered(false)
        const { data: q } = await supabase
          .from('questions')
          .select('*')
          .eq('id', updated.question_ids[updated.current_question_index])
          .single()
        if (q) setQuestion(q)
      }
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [code])

  // Soumettre une réponse
  async function handleAnswer(value: string) {
    if (answered || !game || !question) return
    setAnswered(true)

    const playerId = localStorage.getItem('playerId')
    await fetch('/api/games/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameCode: code,
        playerId,
        questionId: question.id,
        answerValue: value,
      }),
    })
  }

  if (loading || !question || !game) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6 max-w-md mx-auto">

      {/* Header — progression + timer */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-gray-400 text-sm">
          Question {game.current_question_index + 1}/{game.question_count}
        </span>
        <span className="text-xs bg-gray-800 rounded-full px-3 py-1 text-gray-300">
          {question.theme} · diff {question.difficulty}
        </span>
      </div>

      {/* Timer */}
      <Timer startedAt={game.question_started_at} duration={game.question_duration} onExpire={() => setAnswered(true)} />

      {/* Question */}
      <div className="bg-gray-900 rounded-2xl p-5 my-6">
        {question.image && (
          <img
            src={question.image}
            alt="question"
            className="w-full rounded-xl mb-4 object-cover max-h-48"
          />
        )}
        <p className="text-lg font-medium leading-relaxed">{question.question}</p>
      </div>

      {/* Réponses selon le type */}
      {answered && (
        <div className="text-center text-gray-400 text-sm mb-4 animate-pulse">
          Réponse envoyée — en attente des autres joueurs...
        </div>
      )}

      {/* QCM */}
      {(question.type === 'qcm' || question.type === 'image') && (
        <div className="grid grid-cols-2 gap-3">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(String(i))}
              disabled={answered}
              className={`rounded-2xl py-5 px-3 text-sm font-medium transition-all active:scale-95 ${
                answered
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-700 hover:bg-indigo-600 text-white'
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {/* Vrai / Faux */}
      {question.type === 'true_false' && (
        <div className="grid grid-cols-2 gap-3">
          {['Vrai', 'Faux'].map((label, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(String(i))}
              disabled={answered}
              className={`rounded-2xl py-6 text-xl font-bold transition-all active:scale-95 ${
                answered
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : i === 0
                  ? 'bg-green-700 hover:bg-green-600'
                  : 'bg-red-700 hover:bg-red-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Estimation */}
      {question.type === 'estimation' && (
        <EstimationInput onSubmit={handleAnswer} disabled={answered} />
      )}

      {/* Réponse libre */}
      {question.type === 'free_text' && (
        <FreeTextInput onSubmit={handleAnswer} disabled={answered} />
      )}

      {/* Petit bac */}
      {question.type === 'petit_bac' && (
        <PetitBacInput
          categories={question.choices}
          onSubmit={handleAnswer}
          disabled={answered}
        />
      )}
    </main>
  )
}

// ── Sous-composants inline ───────────────────────────────────────────────────

function EstimationInput({ onSubmit, disabled }: { onSubmit: (v: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('')
  return (
    <div className="flex flex-col gap-3">
      <input
        type="number"
        placeholder="Ta réponse..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        className="bg-gray-800 rounded-2xl px-4 py-4 text-center text-2xl outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      />
      <button
        onClick={() => value && onSubmit(value)}
        disabled={disabled || !value}
        className="bg-indigo-600 hover:bg-indigo-500 rounded-2xl py-4 font-bold text-lg disabled:opacity-50 active:scale-95 transition-all"
      >
        Valider
      </button>
    </div>
  )
}

function FreeTextInput({ onSubmit, disabled }: { onSubmit: (v: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('')
  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Ta réponse..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && value && onSubmit(value)}
        disabled={disabled}
        className="bg-gray-800 rounded-2xl px-4 py-4 text-center text-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      />
      <button
        onClick={() => value && onSubmit(value)}
        disabled={disabled || !value}
        className="bg-indigo-600 hover:bg-indigo-500 rounded-2xl py-4 font-bold text-lg disabled:opacity-50 active:scale-95 transition-all"
      >
        Valider
      </button>
    </div>
  )
}

function PetitBacInput({
  categories,
  onSubmit,
  disabled,
}: {
  categories: string[]
  onSubmit: (v: string) => void
  disabled: boolean
}) {
  const [values, setValues] = useState<Record<string, string>>({})

  function handleSubmit() {
    // Sérialise toutes les réponses en JSON string
    onSubmit(JSON.stringify(values))
  }

  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat) => (
        <div key={cat}>
          <label className="text-gray-400 text-sm mb-1 block">{cat}</label>
          <input
            type="text"
            placeholder={`${cat}...`}
            value={values[cat] ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, [cat]: e.target.value }))}
            disabled={disabled}
            className="w-full bg-gray-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
      ))}
      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="bg-indigo-600 hover:bg-indigo-500 rounded-2xl py-4 font-bold text-lg disabled:opacity-50 active:scale-95 transition-all mt-2"
      >
        Valider
      </button>
    </div>
  )
}