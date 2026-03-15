# 🧠 Neural Buzz

A live, multiplayer AI knowledge challenge — like Kahoot, but themed around AI/ML. Up to **100 players** can join simultaneously using a room code or QR code.

---

## ✨ Features

- 🎮 **Host & Player views** — separate interfaces
- 📱 **QR code + 6-char room code** join system
- ⚡ **Real-time** via Pusher WebSockets
- ⏱️ **Countdown timer** with visual pressure
- 🎯 **Speed-based scoring** — answer fast for full points
- 🔥 **Streak bonuses** — 3+ correct in a row = +20%
- ⚔️ **Elimination rounds** — bottom 20% cut every 3 questions
- 🏆 **Live leaderboard** between every question
- 💀 **Elimination screen** for knocked-out players
- 10 **AI-themed questions** (LLMs, prompts, RAG, RLHF, CNNs, hallucinations...)
- 📊 **Final leaderboard** with confetti for top 3

---

## 🚀 Deployment (Vercel)

### Step 1 — Set up Pusher (free)

1. Go to [pusher.com](https://pusher.com) and create a free account
2. Create a new **Channels** app
3. Choose cluster **ap2** (Mumbai, close to India) or your nearest
4. Note down: App ID, Key, Secret, Cluster

### Step 2 — Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# From the neuralbuzz folder:
npm install
vercel deploy
```

Follow the prompts. After first deploy, your app URL will be shown.

### Step 3 — Add Vercel KV (Redis)

1. Go to your Vercel dashboard → **Storage** tab
2. Click **Create Database** → choose **KV**
3. Connect it to your project
4. Vercel auto-injects the `KV_*` environment variables

### Step 4 — Add environment variables in Vercel

Go to your project → **Settings** → **Environment Variables** and add:

```
PUSHER_APP_ID          = <your pusher app id>
PUSHER_APP_KEY         = <your pusher key>
PUSHER_APP_SECRET      = <your pusher secret>
PUSHER_APP_CLUSTER     = ap2

NEXT_PUBLIC_PUSHER_APP_KEY     = <your pusher key>
NEXT_PUBLIC_PUSHER_APP_CLUSTER = ap2

NEXT_PUBLIC_APP_URL    = https://your-app.vercel.app
```

> KV variables are auto-added by Vercel when you connect the storage.

### Step 5 — Redeploy

```bash
vercel deploy --prod
```

---

## 🧪 Local Development

```bash
cp .env.local.example .env.local
# Fill in your Pusher and KV credentials

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🗂️ Project Structure

```
neuralbuzz/
├── app/
│   ├── page.tsx                  # Landing page (host/join)
│   ├── host/[code]/page.tsx      # Host dashboard
│   ├── play/[code]/page.tsx      # Player game screen
│   ├── globals.css               # Full design system
│   ├── layout.tsx
│   └── api/
│       ├── create-room/route.ts  # POST: create room
│       ├── join-room/route.ts    # POST: join room
│       ├── start-game/route.ts   # POST: host starts game
│       ├── submit-answer/route.ts# POST: player submits answer
│       ├── next-question/route.ts# POST: reveal results + eliminate
│       ├── advance-question/route.ts # POST: go to next question
│       └── room/route.ts         # GET: fetch room state
├── lib/
│   ├── questions.ts              # All 10 questions + types
│   ├── pusher.ts                 # Pusher server/client setup
│   └── kv.ts                    # Redis helpers
├── .env.local.example
├── vercel.json
└── package.json
```

---

## 🎮 How to Run a Game

1. **Host** goes to your app URL → clicks "Host a Game"
2. A room code + QR code appears on screen — project this!
3. **Players** scan the QR or go to the URL and type the code
4. Host clicks **Start Game** when everyone has joined
5. Each question appears simultaneously for all players
6. Players tap an answer — faster answers score more
7. Host clicks **End Question** (or waits for timer) → results shown
8. After every 3rd question, bottom 20% are eliminated
9. Host advances to next question
10. Final leaderboard at the end 🏆

---

## ✏️ Customizing Questions

Edit `lib/questions.ts` to add your own questions:

```typescript
{
  id: "q11",
  type: "multiple",         // or "truefalse"
  question: "Your question here?",
  options: ["Option A", "Option B", "Option C", "Option D"],
  correct: 1,               // 0-indexed
  points: 1000,
  timeLimit: 20,            // seconds
  explanation: "Why the answer is correct"
}
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Real-time | Pusher Channels |
| Storage | Vercel KV (Redis) |
| Styling | Custom CSS (no UI lib) |
| Fonts | Orbitron + Inter (Google Fonts) |
| Deploy | Vercel |

---

## 📱 Mobile-Friendly

The player interface is fully responsive and optimized for phones. Players join on their phones; the host screen is designed for a projected display.

---

## 🔒 Limits

- Max **100 players** per room (Pusher free tier: 100 concurrent connections)
- Room TTL: **4 hours** (auto-deleted from Redis)
- **10 questions** by default (easily expandable)
