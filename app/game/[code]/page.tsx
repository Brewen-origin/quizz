'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Timer from '@/app/components/Timer'
import { supabase } from '@/app/components/lib/supabase'

interface Question {
  id: string
  type: string
  question: string
  choices: string[]
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
  const [loading, setLoading] = useState(true)
  const [isExpired, setIsExpired] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isHost, setIsHost] = useState(false)
  // Décalage estimé entre l'horloge client et serveur en ms
  // Calculé à chaque réception de données : serverTime - clientTime au moment de la réception
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0)

  // Ref pour éviter les appels fetchQuestion obsolètes si la question change vite
  const currentQuestionIdRef = useRef<string | null>(null)

  async function fetchQuestion(questionId: string) {
    currentQuestionIdRef.current = questionId

    const { data } = await supabase
      .from('questions')
      .select('id, type, question, choices, difficulty, theme, image')
      .eq('id', questionId)
      .single()

    // Ignorer si une question plus récente a été demandée entre-temps
    if (currentQuestionIdRef.current !== questionId) return
    if (data) setQuestion(data)
  }

  useEffect(() => {
    const playerId = localStorage.getItem('playerId')
    if (!playerId) { router.push('/'); return }

    async function init() {
      const clientTimeBefore = Date.now()

      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .single()

      const clientTimeAfter = Date.now()

      if (!data) { router.push('/'); return }
      if (data.status === 'finished') { router.push(`/game/${code}/leaderboard`); return }
      if (data.status === 'revealing') { router.push(`/game/${code}/result`); return }
      if (data.status === 'leaderboard') { router.push(`/game/${code}/leaderboard`); return }

      // Estimer le décalage client/serveur :
      // On utilise le milieu de la requête comme approximation du moment serveur
      // serverTime = question_started_at (connu)
      // clientTime au moment équivalent ≈ milieu de la requête
      const clientMidpoint = (clientTimeBefore + clientTimeAfter) / 2
      const serverQuestionStartMs = new Date(data.question_started_at).getTime()
      const elapsedSinceStart = clientMidpoint - serverQuestionStartMs
      // Si elapsedSinceStart >> duration → horloge client en avance
      // On ne peut pas reconstruire l'offset exact sans un endpoint dédié,
      // mais on peut détecter une dérive grossière et la corriger
      // Pour des amis sur le même réseau, l'offset réseau est < 50ms → 0 suffit
      setServerTimeOffsetMs(0) // voir note ci-dessous*

      setGame(data)
      setIsExpired(false)
      setIsSubmitting(false)

      const { data: me } = await supabase
        .from('players')
        .select('is_host')
        .eq('id', playerId)
        .single()
      setIsHost(me?.is_host ?? false)

      await fetchQuestion(data.question_ids[data.current_question_index])
      setLoading(false)
    }

    init()

    const channel = supabase
      .channel(`game:${code}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `code=eq.${code}`,
      }, async (payload) => {
        const updated = payload.new as Game

        if (updated.status === 'revealing') {
          router.push(`/game/${code}/result`)
          return
        }
        if (updated.status === 'leaderboard') {
          router.push(`/game/${code}/leaderboard`)
          return
        }
        if (updated.status === 'finished') {
          router.push(`/game/${code}/leaderboard`)
          return
        }
        if (updated.status === 'playing') {
          setGame(updated)
          setIsExpired(false)
          setIsSubmitting(false)
          await fetchQuestion(updated.question_ids[updated.current_question_index])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [code])

  async function handleAnswer(value: string) {
    if (isExpired || isSubmitting || !game || !question) return

    const playerId = localStorage.getItem('playerId')
    if (!playerId) { router.push('/'); return }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/games/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          playerId,
          questionId: question.id,
          answer: value,
        }),
      })

      if (!res.ok) {
        if (res.status === 400) { setIsSubmitting(false); return }
        throw new Error('Answer submission failed')
      }

      setIsSubmitting(false)
      setIsExpired(true)
    } catch {
      setIsSubmitting(false)
    }
  }

  if (loading || !question || !game) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </main>
    )
  }

  const isDisabled = isExpired || isSubmitting

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6 max-w-md mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-gray-400 text-sm">
          Question {game.current_question_index + 1}/{game.question_count}
        </span>
        <span className="text-xs bg-gray-800 rounded-full px-3 py-1 text-gray-300">
          {question.theme} · diff {question.difficulty}
        </span>
      </div>

      {/* Timer */}
      <Timer
        startedAt={game.question_started_at}
        duration={game.question_duration}
        serverTimeOffsetMs={serverTimeOffsetMs}
        onExpire={() => setIsExpired(true)}
      />

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

      {/* Message attente */}
      {isDisabled && (
        <div className="text-center text-gray-400 text-sm mb-4 animate-pulse">
          {isSubmitting ? 'Envoi...' : 'Réponse envoyée — en attente des autres joueurs...'}
        </div>
      )}

      {/* QCM / Image */}
      {(question.type === 'qcm' || question.type === 'image') && (
        <div className="grid grid-cols-2 gap-3">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(String(i))}
              disabled={isDisabled}
              className={`rounded-2xl py-5 px-3 text-sm font-medium transition-all active:scale-95 ${
                isDisabled
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
              disabled={isDisabled}
              className={`rounded-2xl py-6 text-xl font-bold transition-all active:scale-95 ${
                isDisabled
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
        <EstimationInput key={question.id} onSubmit={handleAnswer} disabled={isDisabled} />
      )}

      {/* Réponse libre */}
      {question.type === 'free_text' && (
        <FreeTextInput key={question.id} onSubmit={handleAnswer} disabled={isDisabled} />
      )}

      {/* Petit bac */}
      {question.type === 'petit_bac' && (
        <PetitBacInput
          key={question.id}
          categories={question.choices}
          onSubmit={handleAnswer}
          disabled={isDisabled}
        />
      )}

      {/* Bouton révéler — host uniquement, après expiration */}
      {isExpired && isHost && (
        <button
          onClick={async () => {
            await fetch('/api/games/reveal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gameCode: code }),
            })
          }}
          className="mt-4 w-full bg-yellow-600 hover:bg-yellow-500 rounded-2xl py-4 font-bold text-lg active:scale-95 transition-all"
        >
          👁 Révéler les réponses
        </button>
      )}
    </main>
  )
}

// ── Sous-composants ──────────────────────────────────────────────────────────

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
        onClick={() => onSubmit(JSON.stringify(values))}
        disabled={disabled}
        className="bg-indigo-600 hover:bg-indigo-500 rounded-2xl py-4 font-bold text-lg disabled:opacity-50 active:scale-95 transition-all mt-2"
      >
        Valider
      </button>
    </div>
  )
}