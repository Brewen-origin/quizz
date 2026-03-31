'use client'

import { useState, useEffect, useRef } from 'react'

interface TimerProps {
  startedAt: string      // ISO string depuis games.question_started_at
  duration?: number      // secondes, défaut 15
  onExpire?: () => void  // callback quand timer = 0
  serverTimeOffsetMs: number // gestion pour date générale et pas locale au téléphone
}

export default function Timer({ startedAt, duration = 15, serverTimeOffsetMs,onExpire }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const expiredRef = useRef(false)  // évite d'appeler onExpire plusieurs fois

  useEffect(() => {
    expiredRef.current = false

    function tick() {
      const now = Date.now() + serverTimeOffsetMs
      const elapsed = (now - new Date(startedAt).getTime()) / 1000
      const remaining = Math.max(0, duration - elapsed)
      setTimeLeft(remaining)

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire?.()
      }
    }

    tick() // calcul immédiat au montage (gère le refresh)
    const interval = setInterval(tick, 100) // update toutes les 100ms pour fluidité

    return () => clearInterval(interval)
  }, [startedAt, duration, serverTimeOffsetMs]) // se recalcule si nouvelle question

  const percentage = (timeLeft / duration) * 100

  const color =
    timeLeft <= 5
      ? 'bg-red-500'
      : timeLeft <= 8
      ? 'bg-orange-400'
      : 'bg-indigo-500'

  const textColor =
    timeLeft <= 5
      ? 'text-red-400'
      : timeLeft <= 8
      ? 'text-orange-300'
      : 'text-white'

  return (
    <div className="flex items-center gap-3">
      {/* Chiffre */}
      <span className={`text-2xl font-mono font-bold w-8 text-right ${textColor}`}>
        {Math.ceil(timeLeft)}
      </span>

      {/* Barre */}
      <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-100 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}