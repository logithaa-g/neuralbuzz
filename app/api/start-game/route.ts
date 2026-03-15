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

    const question = QUESTIONS[0];
    const now = Date.now();

    room.status = "question";
    room.currentQuestion = 0;
    room.questionStartTime = now;

    await kv.set(`room:${code}`, room, { ex: 60 * 60 * 4 });

    await pusherServer.trigger(roomChannel(code), EVENTS.GAME_STARTED, {
      question: { ...question, correct: undefined }, // Don't send correct answer to clients
      questionIndex: 0,
      total: QUESTIONS.length,
      startTime: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("start-game error:", error);
    return NextResponse.json({ success: false, error: "Failed to start game" }, { status: 500 });
  }
}
