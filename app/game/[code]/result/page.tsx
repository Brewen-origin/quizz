"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/components/lib/supabase";

interface Question {
  id: string;
  type: string;
  question: string;
  choices: string[];
  answer: string;
  difficulty: number;
  image: string | null;
}

interface PlayerAnswer {
  answer_value: string;
  is_correct: boolean;
  points: number;
}

interface GameData {
  question: Question | null;
  playerAnswer: PlayerAnswer | null;
  isHost: boolean;
  loading: boolean;
  advancing: boolean;
  handleNext: () => void;
}

function useGame(code: string): GameData {
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const [playerAnswer, setPlayerAnswer] = useState<PlayerAnswer | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    const playerId = localStorage.getItem("playerId");
    if (!playerId) {
      router.push("/");
      return;
    }

    let isMounted = true; // prevent state updates if component unmounted

    async function fetchData() {
      try {
        // Get game
        const { data: game } = await supabase
          .from("games")
          .select("id")
          .eq("code", code)
          .single();

        if (!game) {
          router.push("/");
          return;
        }

        // Last answer
        const { data: lastAnswer } = await supabase
          .from("answers")
          .select("question_id, answer_value, is_correct, points")
          .eq("game_id", game.id)
          .eq("player_id", playerId)
          .order("answered_at", { ascending: false })
          .limit(1)
          .single();

        if (!lastAnswer) {
          setPlayerAnswer(null);
        } else {
          setPlayerAnswer({
            answer_value: lastAnswer.answer_value,
            is_correct: lastAnswer.is_correct,
            points: lastAnswer.points,
          });
        }

        // Question
        if (lastAnswer?.question_id) {
          const { data: q } = await supabase
            .from("questions")
            .select("*")
            .eq("id", lastAnswer.question_id)
            .single();

          if (q && isMounted) setQuestion(q);
        }

        // Host check
        const { data: me } = await supabase
          .from("players")
          .select("is_host")
          .eq("id", playerId)
          .single();

        if (isMounted) setIsHost(me?.is_host ?? false);
      } catch (err) {
        console.error(err);
        router.push("/");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel(`result:${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `code=eq.${code}`,
        },
        (payload) => {
          const status = payload.new.status;
          if (status === "playing") router.push(`/game/${code}`);
          if (status === "leaderboard" || status === "finished")
            router.push(`/game/${code}/leaderboard`);
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [code, router]);

  const handleNext = async () => {
    setAdvancing(true);
    try {
      const res = await fetch("/api/games/next-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameCode: code }),
      });
      if (!res.ok) {
        console.error("Failed to advance to next question");
        // TODO notif erreur
      }
    } finally {
      setAdvancing(false);
    }
  };

  return { question, playerAnswer, isHost, loading, advancing, handleNext };
}

export default function ResultPage() {
  const params = useParams();
  const code = params.code as string;
  const { question, playerAnswer, isHost, loading, advancing, handleNext } =
    useGame(code);

  if (loading || !question) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </main>
    );
  }

  const correct = playerAnswer?.is_correct ?? false;
  const points = playerAnswer?.points ?? 0;
  const noAnswer = !playerAnswer;

  function formatCorrectAnswer(q: Question): string {
    if (q.type === "qcm" || q.type === "true_false" || q.type === "image") {
      const index = parseInt(q.answer);
      return q.choices[index] ?? q.answer;
    }
    return q.answer;
  }

  function formatPlayerAnswer(q: Question, value: string): string {
    if (q.type === "qcm" || q.type === "true_false" || q.type === "image") {
      const index = parseInt(value);
      return q.choices[index] ?? value;
    }
    return value;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6 max-w-md mx-auto">
      <div
        className={`rounded-2xl p-6 text-center mb-6 ${
          noAnswer
            ? "bg-gray-800"
            : correct
              ? "bg-green-900/50 border border-green-700"
              : "bg-red-900/50 border border-red-700"
        }`}
      >
        <div className="text-5xl mb-3">
          {noAnswer ? "⏱" : correct ? "✅" : "❌"}
        </div>
        <p className="text-xl font-bold">
          {noAnswer
            ? "Temps écoulé"
            : correct
              ? "Bonne réponse !"
              : "Mauvaise réponse"}
        </p>
        {points > 0 && (
          <p className="text-3xl font-black text-yellow-400 mt-2">
            +{points} pts
          </p>
        )}
      </div>

      <div className="bg-gray-900 rounded-2xl p-4 mb-4">
        {question.image && (
          <img
            src={question.image}
            alt=""
            className="w-full rounded-xl mb-3 max-h-40 object-cover"
          />
        )}
        <p className="text-gray-400 text-sm mb-2">{question.question}</p>

        <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-3">
          <p className="text-xs text-green-400 mb-1">Bonne réponse</p>
          <p className="font-bold text-green-300">
            {formatCorrectAnswer(question)}
          </p>
        </div>

        {playerAnswer && !correct && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 mt-2">
            <p className="text-xs text-red-400 mb-1">Ta réponse</p>
            <p className="font-bold text-red-300">
              {formatPlayerAnswer(question, playerAnswer.answer_value)}
            </p>
          </div>
        )}
      </div>

      {isHost ? (
        <button
          onClick={handleNext}
          disabled={advancing}
          className="mt-auto w-full bg-indigo-600 hover:bg-indigo-500 rounded-2xl py-5 text-xl font-bold active:scale-95 transition-all disabled:opacity-50"
        >
          {advancing ? "Chargement..." : "Question suivante →"}
        </button>
      ) : (
        <div className="mt-auto text-center text-gray-400 text-sm">
          En attente du host...
        </div>
      )}
    </main>
  );
}
