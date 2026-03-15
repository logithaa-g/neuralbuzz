import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Room, QUESTIONS } from "@/lib/questions";
import { pusherServer, roomChannel, EVENTS } from "@/lib/pusher";

export async function POST(req: NextRequest) {
  try {
    const { code, playerId, answer, timeMs } = await req.json();

    const room = await kv.get<Room>(`room:${code}`);
    if (!room) return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });

    const player = room.players[playerId];
    if (!player) return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
    if (player.eliminated) return NextResponse.json({ success: false, error: "Player eliminated" }, { status: 400 });

    const questionIndex = room.currentQuestion;
    const question = QUESTIONS[questionIndex];

    // Check already answered this question
    const alreadyAnswered = player.answers.some((a) => a.questionId === question.id);
    if (alreadyAnswered) return NextResponse.json({ success: false, error: "Already answered" }, { status: 400 });

    const isCorrect = answer === question.correct;
    // Speed bonus: full points if answered in first 25% of time, scales down
    const timeFraction = Math.min(timeMs / (question.timeLimit * 1000), 1);
    const speedMultiplier = isCorrect ? Math.max(0.5, 1 - timeFraction * 0.5) : 0;
    const points = Math.round(question.points * speedMultiplier);

    if (isCorrect) {
      player.streak += 1;
      const streakBonus = player.streak >= 3 ? Math.round(points * 0.2) : 0;
      player.score += points + streakBonus;
    } else {
      player.streak = 0;
    }

    player.answers.push({ questionId: question.id, answer, correct: isCorrect, points, timeMs });
    room.players[playerId] = player;

    await kv.set(`room:${code}`, room, { ex: 60 * 60 * 4 });

    // Broadcast answer count (not who answered what)
    const answeredCount = Object.values(room.players).filter(
      (p) => p.answers.some((a) => a.questionId === question.id)
    ).length;
    const totalActive = Object.values(room.players).filter((p) => !p.eliminated).length;

    await pusherServer.trigger(roomChannel(code), EVENTS.ANSWER_SUBMITTED, {
      answeredCount,
      totalActive,
    });

    return NextResponse.json({ success: true, correct: isCorrect, points });
  } catch (error) {
    console.error("submit-answer error:", error);
    return NextResponse.json({ success: false, error: "Failed to submit answer" }, { status: 500 });
  }
}
