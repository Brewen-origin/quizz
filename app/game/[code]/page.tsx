"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGame, type UseGameReturn } from "@/app/components/hooks/useGame";
import Timer from "@/app/components/Timer";

//  Wrapper : un seul useGame, key pour reset au changement de question
export default function GamePageWrapper() {
  const params = useParams();
  const code = params.code as string;

  // useGame appelé UNE SEULE FOIS ici
  const gameData = useGame(code);

  // key={currentQuestion?.id} force un reset complet du composant
  // à chaque nouvelle question → localAnswered repasse à false automatiquement
  return (
    <GamePage
      key={gameData.currentQuestion?.id ?? "loading"}
      code={code}
      gameData={gameData}
    />
  );
}

interface GamePageProps {
  code: string;
  gameData: UseGameReturn;
}

//  Page principale
function GamePage({ code, gameData }: GamePageProps) {
  const router = useRouter();
  const { game, currentQuestion, myPlayer, hasAnswered, loading } = gameData;

  // État local pour lock instantané de l'UI avant la réponse serveur
  const [localAnswered, setLocalAnswered] = useState(false);
  const [hasTriggeredReveal, setHasTriggeredReveal] = useState(false);

  const isHost = myPlayer?.is_host ?? false;
  const isDisabled = hasAnswered || localAnswered;

  //  Redirections selon status
  useEffect(() => {
    if (!game) return;
    if (game.status === "revealing") router.push(`/game/${code}/result`);
    if (game.status === "leaderboard") router.push(`/game/${code}/leaderboard`);
    if (game.status === "finished") router.push(`/game/${code}/leaderboard`);
    if (game.status === "lobby") router.push(`/lobby/${code}`);
  }, [game?.status, code, router]);

  //  Soumettre une réponse
  async function handleAnswer(value: string) {
    if (isDisabled || !game || !currentQuestion || !myPlayer) return;

    setLocalAnswered(true); // lock UI immédiatement

    try {
      const res = await fetch("/api/games/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          playerId: myPlayer.id,
          questionId: currentQuestion.id,
          answer: value,
        }),
      });
      if (!res.ok) setLocalAnswered(false); // rollback si erreur
    } catch {
      setLocalAnswered(false);
    }
  }

  //  Reveal auto par le host à l'expiration du timer
  function handleTimerExpire() {
    setLocalAnswered(true);

    if (isHost && !hasTriggeredReveal) {
      setHasTriggeredReveal(true);
      fetch("/api/games/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameCode: code }),
      });
    }
  }

  //  Loading
  if (loading || !currentQuestion || !game) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-gray-400 text-sm">
          Question {game.current_question_index + 1}/{game.question_count}
        </span>
        <span className="text-xs bg-gray-800 rounded-full px-3 py-1 text-gray-300">
          {currentQuestion.theme} · diff {currentQuestion.difficulty}
        </span>
      </div>

      {/* Timer */}
      <Timer
        startedAt={game.question_started_at}
        duration={game.question_duration}
        serverTimeOffsetMs={0}
        onExpire={handleTimerExpire}
      />

      {/* Question */}
      <div className="bg-gray-900 rounded-2xl p-5 my-6">
        {currentQuestion.image && (
          <img
            src={currentQuestion.image}
            alt=""
            className="w-full rounded-xl mb-4 object-cover max-h-48"
          />
        )}
        <p className="text-lg font-medium leading-relaxed">
          {currentQuestion.question}
        </p>
      </div>

      {/* Message attente */}
      {isDisabled && (
        <div className="text-center text-gray-400 text-sm mb-4 animate-pulse">
          Réponse envoyée — en attente des autres joueurs...
        </div>
      )}

      {/*  QCM / Image  */}
      {(currentQuestion.type === "qcm" || currentQuestion.type === "image") && (
        <div className="grid grid-cols-2 gap-3">
          {currentQuestion.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(String(i))}
              disabled={isDisabled}
              className={`rounded-2xl py-5 px-3 text-sm font-medium transition-all active:scale-95 ${
                isDisabled
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-indigo-700 hover:bg-indigo-600 text-white"
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {/*  Vrai / Faux  */}
      {currentQuestion.type === "true_false" && (
        <div className="grid grid-cols-2 gap-3">
          {["Vrai", "Faux"].map((label, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(String(i))}
              disabled={isDisabled}
              className={`rounded-2xl py-6 text-xl font-bold transition-all active:scale-95 ${
                isDisabled
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : i === 0
                    ? "bg-green-700 hover:bg-green-600"
                    : "bg-red-700 hover:bg-red-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/*  Estimation  */}
      {currentQuestion.type === "estimation" && (
        <EstimationInput onSubmit={handleAnswer} disabled={isDisabled} />
      )}

      {/*  Réponse libre  */}
      {currentQuestion.type === "free_text" && (
        <FreeTextInput onSubmit={handleAnswer} disabled={isDisabled} />
      )}

      {/*  Petit bac  */}
      {currentQuestion.type === "petit_bac" && (
        <PetitBacInput
          categories={currentQuestion.choices}
          onSubmit={handleAnswer}
          disabled={isDisabled}
        />
      )}

      {/*  Bouton reveal — host uniquement, après réponse/expiration  */}
      {isDisabled && isHost && (
        <button
          onClick={() => {
            if (!hasTriggeredReveal) {
              setHasTriggeredReveal(true);
              fetch("/api/games/reveal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gameCode: code }),
              });
            }
          }}
          className="mt-4 w-full bg-yellow-600 hover:bg-yellow-500 rounded-2xl py-4 font-bold text-lg active:scale-95 transition-all"
        >
          👁 Révéler les réponses
        </button>
      )}
    </main>
  );
}

//  Sous-composants

function EstimationInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (v: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
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
  );
}

function FreeTextInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (v: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Ta réponse..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && value && onSubmit(value)}
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
  );
}

function PetitBacInput({
  categories,
  onSubmit,
  disabled,
}: {
  categories: string[];
  onSubmit: (v: string) => void;
  disabled: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat) => (
        <div key={cat}>
          <label className="text-gray-400 text-sm mb-1 block">{cat}</label>
          <input
            type="text"
            placeholder={`${cat}...`}
            value={values[cat] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [cat]: e.target.value }))
            }
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
  );
}
