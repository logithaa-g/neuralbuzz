"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getPusherClient, roomChannel, EVENTS } from "@/lib/pusher";

type Phase = "waiting" | "question" | "answered" | "results" | "eliminated" | "finished";

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

const OPTION_COLORS = [
  { bg: "rgba(239,68,68,0.2)", border: "rgba(239,68,68,0.5)", active: "rgba(239,68,68,0.45)", label: "A" },
  { bg: "rgba(59,130,246,0.2)", border: "rgba(59,130,246,0.5)", active: "rgba(59,130,246,0.45)", label: "B" },
  { bg: "rgba(245,158,11,0.2)", border: "rgba(245,158,11,0.5)", active: "rgba(245,158,11,0.45)", label: "C" },
  { bg: "rgba(16,185,129,0.2)", border: "rgba(16,185,129,0.5)", active: "rgba(16,185,129,0.45)", label: "D" },
];

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#f472b6"][i % 6],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.6}s`,
    duration: `${0.9 + Math.random() * 0.6}s`,
    size: `${6 + Math.random() * 8}px`,
    rotate: `${Math.random() * 360}deg`,
  }));

  return (
    <div className="confetti-container">
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.left,
            top: "-10px",
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            transform: `rotate(${p.rotate})`,
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function PlayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = (params.code as string).toUpperCase();
  const playerId = searchParams.get("playerId") || (typeof window !== "undefined" ? localStorage.getItem("neuralbuzz_player_id") : "") || "";

  const [phase, setPhase] = useState<Phase>("waiting");
  const [playerName] = useState<string>(typeof window !== "undefined" ? localStorage.getItem("neuralbuzz_player_name") || "Player" : "Player");
  const [playerAvatar, setPlayerAvatar] = useState("🤖");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [currentQ, setCurrentQ] = useState<QuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; points: number } | null>(null);
  const [results, setResults] = useState<ResultData | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState<any[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();
  const questionStartRef = useRef<number>(0);

  // Load player info from room on mount
  useEffect(() => {
    fetch(`/api/room?code=${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.room.players[playerId]) {
          setPlayerAvatar(data.room.players[playerId].avatar);
          setScore(data.room.players[playerId].score);
          setPlayerCount(Object.keys(data.room.players).length);
        }
      });
  }, [code, playerId]);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(roomChannel(code));

    channel.bind(EVENTS.PLAYER_JOINED, (data: { playerCount: number }) => {
      setPlayerCount(data.playerCount);
    });

    channel.bind(EVENTS.GAME_STARTED, (data: QuestionData & { questionIndex: number; total: number; startTime: number }) => {
      setPhase("question");
      setCurrentQ(data);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setAnsweredCount(0);
      questionStartRef.current = data.startTime;
      startTimer(data.timeLimit);
    });

    channel.bind(EVENTS.QUESTION_START, (data: QuestionData) => {
      setPhase("question");
      setCurrentQ(data);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setAnsweredCount(0);
      questionStartRef.current = data.startTime;
      startTimer(data.timeLimit);
    });

    channel.bind(EVENTS.ANSWER_SUBMITTED, (data: { answeredCount: number; totalActive: number }) => {
      setAnsweredCount(data.answeredCount);
      setTotalActive(data.totalActive);
    });

    channel.bind(EVENTS.QUESTION_END, (data: ResultData) => {
      clearInterval(timerRef.current);
      setResults(data);

      // Check if this player was eliminated
      if (data.eliminatedPlayers.includes(playerId)) {
        setPhase("eliminated");
        return;
      }

      // Find rank
      const rank = data.leaderboard.findIndex((p) => p.id === playerId) + 1;
      setMyRank(rank > 0 ? rank : null);

      setPhase("results");
    });

    channel.bind(EVENTS.GAME_OVER, (data: { finalLeaderboard: any[] }) => {
      setFinalLeaderboard(data.finalLeaderboard);
      const myFinalRank = data.finalLeaderboard.findIndex((p) => p.id === playerId) + 1;
      if (myFinalRank <= 3) setShowConfetti(true);
      setPhase("finished");
    });

    return () => { pusher.unsubscribe(roomChannel(code)); pusher.disconnect(); };
  }, [code, playerId]);

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

  const submitAnswer = async (answerIndex: number) => {
    if (selectedAnswer !== null || !currentQ) return;
    setSelectedAnswer(answerIndex);
    clearInterval(timerRef.current);

    const timeMs = Date.now() - questionStartRef.current;

    const res = await fetch("/api/submit-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, playerId, answer: answerIndex, timeMs }),
    });
    const data = await res.json();

    if (data.success) {
      setAnswerResult({ correct: data.correct, points: data.points });
      setPhase("answered");
      if (data.correct) {
        setScore((s) => s + data.points);
        setStreak((s) => s + 1);
        if (data.correct) setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
      } else {
        setStreak(0);
      }
    }
  };

  const timerPct = currentQ ? (timeLeft / currentQ.timeLimit) * 100 : 0;

  // ── WAITING ──
  if (phase === "waiting") {
    return (
      <div className="page">
        {showConfetti && <Confetti />}
        <div style={{ textAlign: "center", maxWidth: 400, width: "100%" }}>
          <div style={{ fontSize: "4rem", marginBottom: "0.5rem" }}>{playerAvatar}</div>
          <h2 style={{ fontFamily: "Orbitron, monospace", fontSize: "1.4rem", marginBottom: "0.25rem" }}>{playerName}</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>Ready to play!</p>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>ROOM CODE</p>
            <div className="room-code" style={{ fontSize: "2.5rem" }}>{code}</div>
          </div>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "1.5rem" }}>
            <span className="badge badge-success">✓ Joined</span>
            <span className="badge badge-primary">👥 {playerCount} players</span>
          </div>

          <div className="card" style={{ background: "var(--surface2)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--primary-glow)", border: "2px solid var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse-ring 2s infinite" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--primary)" }} />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Waiting for host to start...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── QUESTION ──
  if ((phase === "question" || phase === "answered") && currentQ) {
    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "1.5rem" }}>
        {showConfetti && <Confetti />}
        <div style={{ width: "100%", maxWidth: 600 }}>
          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.3rem" }}>{playerAvatar}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{playerName}</div>
                <div style={{ color: "var(--accent)", fontFamily: "Orbitron, monospace", fontWeight: 700, fontSize: "0.85rem" }}>
                  {score.toLocaleString()} pts
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {streak >= 3 && (
                <span className="badge badge-warning">🔥 ×{streak}</span>
              )}
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                border: `3px solid ${timerPct > 40 ? "var(--success)" : timerPct > 20 ? "var(--accent2)" : "var(--danger)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Orbitron, monospace", fontWeight: 900, fontSize: "1.2rem",
                color: timerPct > 40 ? "var(--success)" : timerPct > 20 ? "var(--accent2)" : "var(--danger)",
                transition: "color 0.5s, border-color 0.5s",
                boxShadow: phase === "question" ? `0 0 12px ${timerPct > 40 ? "rgba(16,185,129,0.4)" : timerPct > 20 ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)"}` : "none",
              }}>
                {phase === "answered" ? "✓" : timeLeft}
              </div>
            </div>
          </div>

          {/* Timer bar */}
          <div className="timer-bar" style={{ marginBottom: "1.25rem" }}>
            <div className="timer-fill" style={{
              width: phase === "answered" ? "0%" : `${timerPct}%`,
              background: timerPct > 40 ? "var(--success)" : timerPct > 20 ? "var(--accent2)" : "var(--danger)"
            }} />
          </div>

          {/* Question number */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span className="badge badge-primary">Question {currentQ.questionIndex + 1} of {currentQ.total}</span>
            {phase === "answered" && <span className="badge badge-primary">{answeredCount} answered</span>}
          </div>

          {/* Question text */}
          <div className="card" style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", fontWeight: 600, lineHeight: 1.5 }}>
              {currentQ.question}
            </p>
          </div>

          {/* Answer result banner */}
          {phase === "answered" && answerResult && (
            <div className={`card pop-in`} style={{
              marginBottom: "1.25rem",
              background: answerResult.correct ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)",
              border: `1px solid ${answerResult.correct ? "var(--success)" : "var(--danger)"}`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>
                {answerResult.correct ? "🎉" : "😬"}
              </div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: answerResult.correct ? "var(--success)" : "var(--danger)" }}>
                {answerResult.correct ? "Correct!" : "Wrong!"}
              </div>
              {answerResult.correct && (
                <div style={{ color: "var(--accent)", fontFamily: "Orbitron, monospace", fontWeight: 700, marginTop: "0.25rem" }}>
                  +{answerResult.points.toLocaleString()} pts
                </div>
              )}
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
                Waiting for host to reveal results...
              </p>
            </div>
          )}

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {currentQ.options.map((opt, i) => {
              const col = OPTION_COLORS[i];
              const isSelected = selectedAnswer === i;
              const isDisabled = phase === "answered";

              return (
                <button
                  key={i}
                  className="option-btn"
                  style={{
                    background: isSelected ? col.active : col.bg,
                    border: `2px solid ${isSelected ? "white" : col.border}`,
                    boxShadow: isSelected ? "0 0 0 2px white" : "none",
                    opacity: isDisabled && !isSelected ? 0.5 : 1,
                    transform: isSelected ? "scale(1.02)" : "scale(1)",
                    transition: "all 0.2s",
                  }}
                  onClick={() => submitAnswer(i)}
                  disabled={isDisabled}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: col.border,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "0.85rem", flexShrink: 0,
                  }}>
                    {col.label}
                  </span>
                  <span style={{ fontWeight: 500, lineHeight: 1.3 }}>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS (between questions) ──
  if (phase === "results" && results) {
    const myAnswer = results.leaderboard.find((p) => p.id === playerId);
    const wasCorrect = myAnswer?.lastCorrect ?? false;

    return (
      <div className="page" style={{ justifyContent: "flex-start", paddingTop: "1.5rem" }}>
        <div style={{ width: "100%", maxWidth: 500 }}>
          <h2 style={{ fontFamily: "Orbitron, monospace", textAlign: "center", marginBottom: "1.5rem", fontSize: "1.2rem" }}>
            📊 Round Results
          </h2>

          {/* Correct answer */}
          <div className="card pop-in" style={{
            marginBottom: "1rem",
            background: wasCorrect ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${wasCorrect ? "var(--success)" : "var(--danger)"}`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem" }}>{wasCorrect ? "✅" : "❌"}</div>
            <p style={{ fontWeight: 700, color: wasCorrect ? "var(--success)" : "var(--danger)", marginTop: "0.25rem" }}>
              {wasCorrect ? "You got it right!" : "Not quite!"}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
              <strong style={{ color: "white" }}>Correct: {["A","B","C","D"][results.correctAnswer]}</strong>
              {results.explanation ? ` — ${results.explanation}` : ""}
            </p>
          </div>

          {/* My score */}
          <div className="card" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>YOUR SCORE</p>
              <p style={{ fontFamily: "Orbitron, monospace", fontWeight: 900, fontSize: "1.6rem", color: "var(--accent)" }}>
                {score.toLocaleString()}
              </p>
            </div>
            {myRank && (
              <div style={{ textAlign: "right" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>RANK</p>
                <p style={{ fontFamily: "Orbitron, monospace", fontWeight: 900, fontSize: "1.6rem", color: myRank <= 3 ? "#f59e0b" : "var(--text)" }}>
                  #{myRank}
                </p>
              </div>
            )}
          </div>

          {/* Elimination warning */}
          {results.isEliminationRound && results.eliminatedPlayers.length > 0 && (
            <div className="card" style={{ marginBottom: "1rem", border: "1px solid var(--danger)", background: "rgba(239,68,68,0.08)", textAlign: "center" }}>
              <p style={{ color: "var(--danger)", fontWeight: 700 }}>
                💀 {results.eliminatedPlayers.length} player{results.eliminatedPlayers.length > 1 ? "s were" : " was"} eliminated!
              </p>
            </div>
          )}

          {/* Top 5 leaderboard */}
          <div className="card">
            <h3 style={{ fontFamily: "Orbitron, monospace", fontSize: "0.9rem", marginBottom: "0.75rem", color: "var(--text-muted)" }}>
              TOP PLAYERS
            </h3>
            {results.leaderboard.slice(0, 5).map((p, i) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.5rem 0",
                borderBottom: i < 4 ? "1px solid var(--border)" : "none",
                background: p.id === playerId ? "rgba(99,102,241,0.08)" : "transparent",
                borderRadius: 6,
                paddingLeft: p.id === playerId ? "0.5rem" : 0,
              }}>
                <span style={{ width: 24, fontWeight: 700, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2e" : "var(--text-muted)", fontSize: "0.9rem" }}>
                  #{i + 1}
                </span>
                <span style={{ fontSize: "1.2rem" }}>{p.avatar}</span>
                <span style={{ flex: 1, fontWeight: p.id === playerId ? 700 : 500, fontSize: "0.9rem" }}>
                  {p.name} {p.id === playerId ? "(you)" : ""}
                </span>
                {p.streak >= 3 && <span style={{ fontSize: "0.8rem" }}>🔥</span>}
                <span style={{ fontFamily: "Orbitron, monospace", fontSize: "0.9rem", color: "var(--accent)", fontWeight: 700 }}>
                  {p.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem" }}>
            ⏳ Waiting for host to start next question...
          </p>
        </div>
      </div>
    );
  }

  // ── ELIMINATED ──
  if (phase === "eliminated") {
    return (
      <div className="page">
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: "5rem", marginBottom: "1rem" }}>💀</div>
          <h2 style={{ fontFamily: "Orbitron, monospace", fontSize: "1.8rem", color: "var(--danger)", marginBottom: "0.5rem" }}>
            Eliminated!
          </h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
            You didn't make the cut this round. Better luck next time!
          </p>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>FINAL SCORE</p>
            <p style={{ fontFamily: "Orbitron, monospace", fontWeight: 900, fontSize: "2.5rem", color: "var(--accent)" }}>
              {score.toLocaleString()}
            </p>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            You can still watch the rest of the game unfold...
          </p>
          <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--surface2)", borderRadius: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--danger)", display: "inline-block", animation: "pulse-ring 2s infinite", marginRight: "0.5rem" }} />
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Game in progress...</span>
          </div>
        </div>
      </div>
    );
  }

  // ── FINISHED ──
  if (phase === "finished") {
    const myEntry = finalLeaderboard.find((p) => p.id === playerId);
    const myFinalRank = finalLeaderboard.findIndex((p) => p.id === playerId) + 1;
    const isTopThree = myFinalRank >= 1 && myFinalRank <= 3;

    return (
      <div className="page">
        {isTopThree && <Confetti />}
        <div style={{ textAlign: "center", maxWidth: 500, width: "100%" }}>
          <div style={{ fontSize: "4rem", marginBottom: "0.75rem" }}>
            {myFinalRank === 1 ? "🥇" : myFinalRank === 2 ? "🥈" : myFinalRank === 3 ? "🥉" : "🎮"}
          </div>
          <h1 style={{ fontFamily: "Orbitron, monospace", fontSize: "1.8rem", marginBottom: "0.5rem" }}>
            {myFinalRank === 1 ? "WINNER!" : isTopThree ? "Top 3!" : "Game Over!"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
            {myFinalRank === 1 ? "🧠 You are the Neural Buzz champion!" : `You finished #${myFinalRank}`}
          </p>

          <div className="card" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-around" }}>
            <div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>FINAL SCORE</p>
              <p style={{ fontFamily: "Orbitron, monospace", fontWeight: 900, fontSize: "1.8rem", color: "var(--accent)" }}>
                {myEntry?.score?.toLocaleString() ?? score.toLocaleString()}
              </p>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>RANK</p>
              <p style={{ fontFamily: "Orbitron, monospace", fontWeight: 900, fontSize: "1.8rem", color: isTopThree ? "#f59e0b" : "var(--text)" }}>
                #{myFinalRank || "?"}
              </p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontFamily: "Orbitron, monospace", fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              FINAL LEADERBOARD
            </h3>
            {finalLeaderboard.slice(0, 10).map((p, i) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.55rem 0.5rem",
                borderRadius: 8,
                borderBottom: i < Math.min(9, finalLeaderboard.length - 1) ? "1px solid var(--border)" : "none",
                background: p.id === playerId ? "rgba(99,102,241,0.12)" : "transparent",
              }}>
                <span style={{ width: 28, fontWeight: 700, fontSize: "0.9rem", color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2e" : "var(--text-muted)" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span style={{ fontSize: "1.2rem" }}>{p.avatar}</span>
                <span style={{ flex: 1, fontWeight: p.id === playerId ? 700 : 400, fontSize: "0.9rem" }}>
                  {p.name} {p.id === playerId ? <span style={{ color: "var(--primary)" }}>(you)</span> : ""}
                </span>
                <span style={{ fontFamily: "Orbitron, monospace", fontSize: "0.9rem", fontWeight: 700, color: "var(--accent)" }}>
                  {p.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => window.location.href = "/"}>
            Play Again 🚀
          </button>
        </div>
      </div>
    );
  }

  return null;
}
