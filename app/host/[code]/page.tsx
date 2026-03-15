"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getPusherClient, roomChannel, EVENTS } from "@/lib/pusher";
import { Player, QUESTIONS } from "@/lib/questions";
import QRCode from "qrcode";

type GamePhase = "waiting" | "question" | "results" | "finished";

interface QuestionData {
  id: string;
  question: string;
  options: string[];
  timeLimit: number;
  type: string;
  questionIndex: number;
  total: number;
  startTime: number;
}

interface ResultData {
  correctAnswer: number;
  explanation: string;
  leaderboard: Array<{ id: string; name: string; avatar: string; score: number; streak: number; lastCorrect: boolean }>;
  eliminatedPlayers: string[];
  isEliminationRound: boolean;
}

export default function HostPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = (params.code as string).toUpperCase();
  const hostId = searchParams.get("hostId") || localStorage.getItem("neuralbuzz_host_id") || "";

  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [currentQ, setCurrentQ] = useState<QuestionData | null>(null);
  const [results, setResults] = useState<ResultData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLastQuestion, setIsLastQuestion] = useState(false);
  const [finalLeaderboard, setFinalLeaderboard] = useState<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    QRCode.toDataURL(`${appUrl}?join=${code}`, { width: 200, margin: 1, color: { dark: "#6366f1", light: "#050510" } })
      .then(setQrUrl);
  }, [code, appUrl]);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(roomChannel(code));

    channel.bind(EVENTS.PLAYER_JOINED, (data: { player: Player }) => {
      setPlayers((prev) => ({ ...prev, [data.player.id]: data.player }));
    });

    channel.bind(EVENTS.GAME_STARTED, (data: QuestionData) => {
      setPhase("question");
      setCurrentQ(data);
      setAnsweredCount(0);
      startTimer(data.timeLimit);
    });

    channel.bind(EVENTS.QUESTION_START, (data: QuestionData) => {
      setPhase("question");
      setCurrentQ(data);
      setAnsweredCount(0);
      startTimer(data.timeLimit);
    });

    channel.bind(EVENTS.ANSWER_SUBMITTED, (data: { answeredCount: number }) => {
      setAnsweredCount(data.answeredCount);
    });

    channel.bind(EVENTS.QUESTION_END, (data: ResultData) => {
      setPhase("results");
      setResults(data);
      clearTimeout(timerRef.current);
    });

    channel.bind(EVENTS.GAME_OVER, (data: { finalLeaderboard: any[] }) => {
      setPhase("finished");
      setFinalLeaderboard(data.finalLeaderboard);
    });

    return () => { pusher.unsubscribe(roomChannel(code)); pusher.disconnect(); };
  }, [code]);

  const startTimer = (seconds: number) => {
    setTimeLeft(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const startGame = async () => {
    setLoading(true);
    await fetch("/api/start-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, hostId }),
    });
    setLoading(false);
  };

  const endQuestion = async () => {
    setLoading(true);
    clearInterval(timerRef.current);
    const res = await fetch("/api/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, hostId }),
    });
    const data = await res.json();
    setIsLastQuestion(data.isLastQuestion);
    setLoading(false);
  };

  const advanceQuestion = async () => {
    setLoading(true);
    await fetch("/api/advance-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, hostId }),
    });
    setLoading(false);
  };

  const playerList = Object.values(players);
  const optionColors = ["var(--opt-a)", "var(--opt-b)", "var(--opt-c)", "var(--opt-d)"];
  const optionLabels = ["A", "B", "C", "D"];

  // ── WAITING LOBBY ──
  if (phase === "waiting") {
    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "2rem" }}>
        <div style={{ width: "100%", maxWidth: 900 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
            <h1 className="logo" style={{ fontSize: "1.8rem" }}>
              <span className="logo-neural">Neural</span><span className="logo-buzz"> Buzz</span>
            </h1>
            <span className="badge badge-primary">HOST VIEW</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* Room Code */}
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem", fontSize: "0.9rem" }}>ROOM CODE</p>
              <div className="room-code">{code}</div>
              <p style={{ color: "var(--text-muted)", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                Go to <strong style={{ color: "var(--accent)" }}>{appUrl.replace("https://", "").replace("http://", "")}</strong>
              </p>
              {qrUrl && (
                <div style={{ marginTop: "1rem" }}>
                  <img src={qrUrl} alt="QR code" style={{ width: 140, height: 140, borderRadius: 8 }} />
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.5rem" }}>Scan to join</p>
                </div>
              )}
            </div>

            {/* Players */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ fontFamily: "Orbitron, monospace" }}>Players</h3>
                <span className="badge badge-success">{playerList.length} / 100</span>
              </div>
              <div style={{ maxHeight: 250, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {playerList.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem 0" }}>
                    Waiting for players to join...
                  </p>
                ) : (
                  playerList.map((p, i) => (
                    <div key={p.id} className="slide-up" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem", borderRadius: "8px", background: "var(--surface2)" }}>
                      <span style={{ fontSize: "1.3rem" }}>{p.avatar}</span>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Start */}
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <button
              className="btn btn-accent pulse"
              style={{ fontSize: "1.2rem", padding: "1.1rem 3rem", minWidth: 240 }}
              onClick={startGame}
              disabled={loading || playerList.length === 0}
            >
              {loading ? "Starting..." : `🚀 Start Game (${playerList.length} players)`}
            </button>
            <p style={{ color: "var(--text-muted)", marginTop: "0.75rem", fontSize: "0.85rem" }}>
              Game has {QUESTIONS.length} questions · Elimination every 3 rounds
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── QUESTION PHASE ──
  if (phase === "question" && currentQ) {
    const totalActive = Object.values(players).filter(p => !p.eliminated).length;
    const progress = totalActive > 0 ? (answeredCount / totalActive) * 100 : 0;
    const timerPct = (timeLeft / currentQ.timeLimit) * 100;

    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: 900 }}>
          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <span className="badge badge-primary">Q{currentQ.questionIndex + 1}/{currentQ.total}</span>
              <span className="badge badge-warning">{answeredCount}/{totalActive} answered</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontFamily: "Orbitron, monospace", fontSize: "2rem", fontWeight: 700, color: timerPct > 40 ? "var(--success)" : timerPct > 20 ? "var(--accent2)" : "var(--danger)" }}>
                {timeLeft}
              </span>
              <button className="btn btn-outline" style={{ padding: "0.6rem 1.2rem" }} onClick={endQuestion} disabled={loading}>
                End Early →
              </button>
            </div>
          </div>

          {/* Timer bar */}
          <div className="timer-bar" style={{ marginBottom: "1.5rem" }}>
            <div className="timer-fill" style={{
              width: `${timerPct}%`,
              background: timerPct > 40 ? "var(--success)" : timerPct > 20 ? "var(--accent2)" : "var(--danger)"
            }} />
          </div>

          {/* Question */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              {currentQ.type === "truefalse" ? "TRUE / FALSE" : "MULTIPLE CHOICE"} · {currentQ.timeLimit}s
            </p>
            <p style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.4rem)", fontWeight: 600, lineHeight: 1.4 }}>
              {currentQ.question}
            </p>
          </div>

          {/* Options */}
          <div style={{ display: "grid", gridTemplateColumns: currentQ.type === "truefalse" ? "1fr 1fr" : "1fr 1fr", gap: "0.75rem" }}>
            {currentQ.options.map((opt, i) => (
              <div key={i} style={{
                background: `${optionColors[i]}22`,
                border: `2px solid ${optionColors[i]}66`,
                borderRadius: "12px",
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: optionColors[i],
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: "0.85rem", flexShrink: 0
                }}>{optionLabels[i]}</span>
                <span style={{ fontWeight: 500 }}>{opt}</span>
              </div>
            ))}
          </div>

          {/* Answer progress */}
          <div style={{ marginTop: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Responses</span>
              <span style={{ fontSize: "0.85rem" }}>{answeredCount} / {totalActive}</span>
            </div>
            <div className="timer-bar" style={{ height: 10 }}>
              <div className="timer-fill" style={{ width: `${progress}%`, background: "var(--primary)" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS PHASE ──
  if (phase === "results" && results) {
    const optLabels = ["A", "B", "C", "D"];
    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: 900 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ fontFamily: "Orbitron, monospace", fontSize: "1.3rem" }}>📊 Results</h2>
            {results.isEliminationRound && (
              <span className="badge badge-danger">⚔️ Elimination Round!</span>
            )}
          </div>

          {/* Correct answer */}
          <div className="card" style={{ marginBottom: "1.5rem", border: "1px solid var(--success)", background: "rgba(16,185,129,0.08)" }}>
            <p style={{ color: "var(--success)", fontWeight: 700, marginBottom: "0.35rem" }}>
              ✅ Correct Answer: {optLabels[results.correctAnswer]}
            </p>
            {results.explanation && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{results.explanation}</p>
            )}
          </div>

          {/* Eliminated */}
          {results.eliminatedPlayers.length > 0 && (
            <div className="card" style={{ marginBottom: "1.5rem", border: "1px solid var(--danger)", background: "rgba(239,68,68,0.08)" }}>
              <p style={{ color: "var(--danger)", fontWeight: 700 }}>
                💀 Eliminated: {results.eliminatedPlayers.length} player(s) eliminated this round!
              </p>
            </div>
          )}

          {/* Leaderboard */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontFamily: "Orbitron, monospace", marginBottom: "1rem", fontSize: "1rem" }}>🏆 Top Players</h3>
            {results.leaderboard.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.6rem 0", borderBottom: i < results.leaderboard.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 28, fontFamily: "Orbitron, monospace", fontWeight: 700, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2e" : "var(--text-muted)" }}>
                  #{i + 1}
                </span>
                <span style={{ fontSize: "1.3rem" }}>{p.avatar}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                {p.streak >= 3 && <span title="Streak!">🔥×{p.streak}</span>}
                <span style={{ color: p.lastCorrect ? "var(--success)" : "var(--danger)", marginRight: "0.5rem" }}>
                  {p.lastCorrect ? "✓" : "✗"}
                </span>
                <span style={{ fontFamily: "Orbitron, monospace", fontWeight: 700, color: "var(--accent)" }}>
                  {p.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <button
            className="btn btn-accent"
            style={{ width: "100%", fontSize: "1.1rem", padding: "1rem" }}
            onClick={advanceQuestion}
            disabled={loading}
          >
            {loading ? "Loading..." : isLastQuestion ? "🏁 See Final Results" : "Next Question →"}
          </button>
        </div>
      </div>
    );
  }

  // ── FINISHED ──
  if (phase === "finished") {
    return (
      <div className="page">
        <div style={{ textAlign: "center", maxWidth: 600, width: "100%" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🏆</div>
          <h1 className="logo" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
            <span className="logo-neural">Game</span><span className="logo-buzz"> Over!</span>
          </h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>Final Leaderboard</p>

          <div className="card">
            {finalLeaderboard.slice(0, 10).map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 0", borderBottom: i < Math.min(9, finalLeaderboard.length - 1) ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 36, fontFamily: "Orbitron, monospace", fontWeight: 900, fontSize: "1.1rem", color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2e" : "var(--text-muted)" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span style={{ fontSize: "1.5rem" }}>{p.avatar}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: "1.05rem" }}>{p.name}</span>
                <span style={{ fontFamily: "Orbitron, monospace", fontWeight: 700, color: "var(--accent)", fontSize: "1.1rem" }}>
                  {p.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" style={{ marginTop: "2rem", width: "100%" }} onClick={() => window.location.href = "/"}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
