import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Room, Player, AVATARS } from "@/lib/questions";
import { pusherServer, roomChannel, EVENTS } from "@/lib/pusher";

export async function POST(req: NextRequest) {
  try {
    const { code, playerName, playerId } = await req.json();

    const room = await kv.get<Room>(`room:${code.toUpperCase()}`);
    if (!room) return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    if (room.status !== "waiting") return NextResponse.json({ success: false, error: "Game already started" }, { status: 400 });

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= 100) return NextResponse.json({ success: false, error: "Room is full (max 100)" }, { status: 400 });

    // Check name not taken
    const nameTaken = Object.values(room.players).some(
      (p) => p.name.toLowerCase() === playerName.toLowerCase()
    );
    if (nameTaken) return NextResponse.json({ success: false, error: "Name already taken" }, { status: 400 });

    const player: Player = {
      id: playerId,
      name: playerName,
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      score: 0,
      streak: 0,
      answers: [],
      eliminated: false,
    };

    room.players[playerId] = player;
    await kv.set(`room:${code.toUpperCase()}`, room, { ex: 60 * 60 * 4 });

    await pusherServer.trigger(roomChannel(code.toUpperCase()), EVENTS.PLAYER_JOINED, {
      player,
      playerCount: Object.keys(room.players).length,
    });

    return NextResponse.json({ success: true, player, room });
  } catch (error) {
    console.error("join-room error:", error);
    return NextResponse.json({ success: false, error: "Failed to join room" }, { status: 500 });
  }
}
