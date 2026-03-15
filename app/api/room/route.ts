import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Room } from "@/lib/questions";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ success: false, error: "No code" }, { status: 400 });

  const room = await kv.get<Room>(`room:${code.toUpperCase()}`);
  if (!room) return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });

  return NextResponse.json({ success: true, room });
}
