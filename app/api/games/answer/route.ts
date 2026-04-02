import { NextResponse } from "next/server";
import { supabase } from "@/app/components/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { gameId, playerId, questionId, answer } = body;

    if (!gameId || !playerId || !questionId || answer === undefined) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Récupérer la question
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    // Calcul résultat
    let isCorrect = false;

    if (question.type === "estimation") {
      const correctValue = Number(question.answer);
      const userValue = Number(answer);

      if (!isNaN(userValue)) {
        const tolerance = correctValue * 0.1;
        isCorrect =
          userValue >= correctValue - tolerance &&
          userValue <= correctValue + tolerance;
      }
    } else {
      isCorrect =
        String(answer).trim().toLowerCase() ===
        String(question.answer).trim().toLowerCase();
    }

    // Points
    const points = isCorrect ? question.difficulty * 100 : 0;
    // Appel RPC dans supabase
    const { error: rpcError } = await supabase.rpc(
      "record_answer_and_increment_score",
      {
        p_game_id: gameId,
        p_player_id: playerId,
        p_question_id: questionId,
        p_answer_value: String(answer),
        p_is_correct: isCorrect,
        p_points: points,
      },
    );

    if (rpcError) {
      if (rpcError.code === "23505") {
        return NextResponse.json(
          { error: "Already answered" },
          { status: 400 },
        );
      }

      console.error("[RPC ERROR]", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, isCorrect, points });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
