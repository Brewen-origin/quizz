// app/components/hooks/useGame.ts
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/components/lib/supabase";

export interface Game {
  id: string;
  code: string;
  status:
    | "lobby"
    | "playing"
    | "revealing"
    | "leaderboard"
    | "finished"
    | "paused";
  current_question_index: number;
  question_count: number;
  question_ids: string[];
  question_started_at: string;
  question_duration: number;
  themes: string[];
}

export interface Player {
  id: string;
  pseudo: string;
  score: number;
  is_host: boolean;
  connected: boolean;
}

export interface Question {
  id: string;
  type: string;
  question: string;
  choices: string[];
  answer: string;
  difficulty: number;
  theme: string;
  image: string | null;
}

export interface UseGameReturn {
  game: Game | null;
  players: Player[];
  currentQuestion: Question | null;
  myPlayer: Player | null;
  hasAnswered: boolean;
  loading: boolean;
  error: string | null;
}

export function useGame(code: string): UseGameReturn {
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentQuestionIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  async function fetchQuestion(questionId: string) {
    if (!questionId) return;
    currentQuestionIdRef.current = questionId;

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (error) {
      console.error("[useGame] fetchQuestion error:", error);
      return;
    }
    if (currentQuestionIdRef.current !== questionId) return;
    if (data) setCurrentQuestion(data);
  }

  async function checkHasAnswered(playerId: string, questionId: string) {
    if (!playerId || !questionId) return;
    const { data } = await supabase
      .from("answers")
      .select("id")
      .eq("player_id", playerId)
      .eq("question_id", questionId)
      .maybeSingle();
    setHasAnswered(!!data);
  }

  useEffect(() => {
    const playerId = localStorage.getItem("playerId");
    if (!playerId) {
      router.push("/?error=session_perdue");
      return;
    }

    async function init() {
      try {
        // 1. Fetch game
        const { data: gameData, error: gameError } = await supabase
          .from("games")
          .select("*")
          .eq("code", code)
          .single();

        if (gameError || !gameData) {
          setError("Partie introuvable");
          router.push("/home");
          return;
        }

        // 2. Fetch players
        const { data: playersData } = await supabase
          .from("players")
          .select("*")
          .eq("game_id", gameData.id)
          .order("score", { ascending: false });

        const playersList = playersData ?? [];
        setPlayers(playersList);

        const me = playersList.find((p) => p.id === playerId) ?? null;
        setMyPlayer(me);

        if (!me) {
          setError("Joueur introuvable");
          router.push("/home");
          return;
        }

        // 3. Marquer connecté
        await supabase
          .from("players")
          .update({ connected: true, last_seen: new Date().toISOString() })
          .eq("id", playerId);

        setGame(gameData);

        // 4. Charger question courante si en jeu
        if (
          ["playing", "revealing"].includes(gameData.status) &&
          gameData.question_ids?.length > 0
        ) {
          const questionId =
            gameData.question_ids[gameData.current_question_index];
          await fetchQuestion(questionId);
          await checkHasAnswered(playerId, questionId);
        }

        setLoading(false);

        // ✅ 5. Subscription ICI — gameData.id est disponible
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }

        const channel = supabase
          .channel(`use-game:${gameData.id}`)

          // games UPDATE — filtré par id (plus fiable que code)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "games",
              filter: `id=eq.${gameData.id}`,
            },
            async (payload) => {
              console.log("[Realtime] game update →", payload.new.status);
              const updated = payload.new as Game;
              setGame(updated);

              if (
                updated.status === "playing" &&
                updated.question_ids?.length > 0
              ) {
                const questionId =
                  updated.question_ids[updated.current_question_index];
                await fetchQuestion(questionId);
                await checkHasAnswered(playerId, questionId);
              }
            },
          )

          // players INSERT
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "players",
              filter: `game_id=eq.${gameData.id}`, // ✅ gameData.id, pas gameIdRef
            },
            (payload) => {
              const p = payload.new as Player;
              setPlayers((prev) =>
                prev.find((x) => x.id === p.id)
                  ? prev
                  : [...prev, p].sort((a, b) => b.score - a.score),
              );
            },
          )

          // players UPDATE
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "players",
              filter: `game_id=eq.${gameData.id}`, // ✅ gameData.id, pas gameIdRef
            },
            (payload) => {
              const p = payload.new as Player;
              setPlayers((prev) =>
                prev
                  .map((x) => (x.id === p.id ? p : x))
                  .sort((a, b) => b.score - a.score),
              );
              if (p.id === playerId) setMyPlayer(p);
            },
          )

          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        console.error("[useGame] init error:", err);
        setError("Erreur de chargement");
        setLoading(false);
      }
    }

    init();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [code]);

  return {
    game,
    players,
    currentQuestion,
    myPlayer,
    hasAnswered,
    loading,
    error,
  };
}
