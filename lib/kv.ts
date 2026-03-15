import { kv } from "@vercel/kv";
import { Room } from "./questions";

const ROOM_TTL = 60 * 60 * 4; // 4 hours

export async function getRoom(code: string): Promise<Room | null> {
  return await kv.get<Room>(`room:${code}`);
}

export async function saveRoom(room: Room): Promise<void> {
  await kv.set(`room:${code(room)}`, room, { ex: ROOM_TTL });
}

export async function deleteRoom(code: string): Promise<void> {
  await kv.del(`room:${code}`);
}

function code(room: Room) {
  return room.code;
}
