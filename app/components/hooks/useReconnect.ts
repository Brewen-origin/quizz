"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/components/lib/supabase";

export function useReconnect() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      const playerId = localStorage.getItem("playerId");
      const gameCode = localStorage.getItem("gameCode");

      // Rien en localStorage → pas de reconnexion possible
      if (!playerId || !gameCode) {
        setChecking(false);
        return;
      }

      try {
        // Fetch la partie
        const { data: game, error: gameError } = await supabase
          .from("games")
          .select("id, code, status")
          .eq("code", gameCode)
          .single();

        if (gameError) {
          console.error("[useReconnect][game_query]", gameError);
          setChecking(false);
          return;
        }

        if (!game) {
          // Partie introuvable ou terminée → nettoie et reste sur /home
          localStorage.removeItem("playerId");
          localStorage.removeItem("gameCode");
          setChecking(false);
          return;
        }

        // Partie terminée → nettoie
        if (game.status === "finished") {
          localStorage.removeItem("playerId");
          localStorage.removeItem("gameCode");
          setChecking(false);
          return;
        }

        // Vérifie que le joueur existe toujours dans cette partie
        const { data: player, error: playerError } = await supabase
          .from("players")
          .select("id")
          .eq("id", playerId)
          .eq("game_id", game.id)
          .maybeSingle();

        if (playerError) {
          console.error("[useReconnect][player_query]", playerError);
          setChecking(false);
          return;
        }

        if (!player) {
          // Joueur supprimé ou partie différente → nettoie
          localStorage.removeItem("playerId");
          localStorage.removeItem("gameCode");
          setChecking(false);
          return;
        }

        // ✅ Joueur valide → redirige selon le statut de la partie
        switch (game.status) {
          case "lobby":
            router.replace(`/lobby/${gameCode}`);
            break;
          case "playing":
            router.replace(`/game/${gameCode}`);
            break;
          case "revealing":
            router.replace(`/game/${gameCode}/result`);
            break;
          case "leaderboard":
            router.replace(`/game/${gameCode}/leaderboard`);
            break;
          default:
            setChecking(false);
        }
      } catch (err) {
        console.error("[useReconnect]", err);
        setChecking(false);
      }
    }

    check();
  }, []);

  return { checking };
}
