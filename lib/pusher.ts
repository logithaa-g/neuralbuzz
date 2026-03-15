import Pusher from "pusher";
import PusherClient from "pusher-js";

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_APP_KEY!,
  secret: process.env.PUSHER_APP_SECRET!,
  cluster: process.env.PUSHER_APP_CLUSTER!,
  useTLS: true,
});

export const getPusherClient = () =>
  new PusherClient(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER!,
  });

// Channel naming
export const roomChannel = (code: string) => `room-${code}`;

// Events
export const EVENTS = {
  PLAYER_JOINED: "player-joined",
  PLAYER_LEFT: "player-left",
  GAME_STARTED: "game-started",
  QUESTION_START: "question-start",
  ANSWER_SUBMITTED: "answer-submitted",
  QUESTION_END: "question-end",
  LEADERBOARD: "leaderboard",
  GAME_OVER: "game-over",
  ELIMINATION: "elimination",
} as const;
