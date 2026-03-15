import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
const kv = Redis.fromEnv();
import { Room } from "@/lib/questions";

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const { hostId } = await req.json();

    let code = generateCode();
    // Ensure uniqueness
    let existing = await kv.get(`room:${code}`);
    while (existing) {
      code = generateCode();
      existing = await kv.get(`room:${code}`);
    }

    const room: Room = {
      id: `room_${Date.now()}`,
      code,
      hostId,
      players: {},
      status: "waiting",
      currentQuestion: 0,
      createdAt: Date.now(),
    };

    await kv.set(`room:${code}`, room, { ex: 60 * 60 * 4 });

    return NextResponse.json({ success: true, code, room });
  } catch (error) {
    console.error("create-room error:", error);
    return NextResponse.json({ success: false, error: "Failed to create room" }, { status: 500 });
  }
}
