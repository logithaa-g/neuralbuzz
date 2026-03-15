import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
const kv = Redis.fromEnv();
import { Room, QUESTIONS } from "@/lib/questions";
import { pusherServer, roomChannel, EVENTS } from "@/lib/pusher";

export async function POST(req: NextRequest) {
  try {
    const { code, hostId } = await req.json();

    const room = await kv.get<Room>(`room:${code}`);
    if (!room) return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    if (room.hostId !== hostId) return NextResponse.json({ success: false, error: "Not the host" }, { status: 403 });

    const currentQ = QUESTIONS[room.currentQuestion];

    // Build leaderboard + reveal correct answer
    const sortedPlayers = Object.values(room.players)
      .filter((p) => !p.eliminated)
      .sort((a, b) => b.score - a.score);

    // Elimination: after every 3rd question, eliminate bottom 20% (min 1 player)
    const isEliminationRound = (room.currentQuestion + 1) % 3 === 0 && sortedPlayers.length > 2;
    let eliminatedPlayers: string[] = [];

    if (isEliminationRound) {
      const eliminateCount = Math.max(1, Math.floor(sortedPlayers.length * 0.2));
      const toEliminate = sortedPlayers.slice(-eliminateCount);
      toEliminate.forEach((p) => {
        room.players[p.id].eliminated = true;
        eliminatedPlayers.push(p.id);
      });
    }

    // Send question results
    await pusherServer.trigger(roomChannel(code), EVENTS.QUESTION_END, {
      correctAnswer: currentQ.correct,
      explanation: currentQ.explanation,
      leaderboard: sortedPlayers.slice(0, 10).map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        streak: p.streak,
        lastCorrect: p.answers.find((a) => a.questionId === currentQ.id)?.correct ?? false,
        eliminated: false,
      })),
      eliminatedPlayers,
      isEliminationRound,
    });

    await kv.set(`room:${code}`, room, { ex: 60 * 60 * 4 });

    const isLastQuestion = room.currentQuestion >= QUESTIONS.length - 1;

    return NextResponse.json({
      success: true,
      isLastQuestion,
      eliminatedPlayers,
    });
  } catch (error) {
    console.error("next-question error:", error);
    return NextResponse.json({ success: false, error: "Failed to advance question" }, { status: 500 });
  }
}
