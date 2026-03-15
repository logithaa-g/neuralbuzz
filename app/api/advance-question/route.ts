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

    const nextIndex = room.currentQuestion + 1;

    if (nextIndex >= QUESTIONS.length) {
      // Game over
      const finalLeaderboard = Object.values(room.players)
        .sort((a, b) => b.score - a.score)
        .map((p, i) => ({ ...p, rank: i + 1 }));

      room.status = "finished";
      await kv.set(`room:${code}`, room, { ex: 60 * 60 * 4 });

      await pusherServer.trigger(roomChannel(code), EVENTS.GAME_OVER, { finalLeaderboard });
      return NextResponse.json({ success: true, gameOver: true });
    }

    const now = Date.now();
    room.currentQuestion = nextIndex;
    room.questionStartTime = now;
    room.status = "question";

    await kv.set(`room:${code}`, room, { ex: 60 * 60 * 4 });

    const question = QUESTIONS[nextIndex];
    await pusherServer.trigger(roomChannel(code), EVENTS.QUESTION_START, {
      question: { ...question, correct: undefined },
      questionIndex: nextIndex,
      total: QUESTIONS.length,
      startTime: now,
    });

    return NextResponse.json({ success: true, gameOver: false });
  } catch (error) {
    console.error("advance-question error:", error);
    return NextResponse.json({ success: false, error: "Failed to advance" }, { status: 500 });
  }
}
