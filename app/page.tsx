"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [joinCode, setJoinCode] = useState(searchParams.get("join") || "");
  const [playerName, setPlayerName] = useState("");
  const [view, setView] = useState<"home" | "join">(searchParams.get("join") ? "join" : "home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hostGame = async () => {
    setLoading(true);
    const hostId = `host_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if (typeof window !== "undefined") localStorage.setItem("neuralbuzz_host_id", hostId);
    const res = await fetch("/api/create-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId }),
    });
    const data = await res.json();
    if (data.success) {
      router.push(`/host/${data.code}?hostId=${hostId}`);
    } else {
      setError("Failed to create room. Please try again.");
      setLoading(false);
    }
  };

  const joinGame = async () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    setLoading(true);
    setError("");
    const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if (typeof window !== "undefined") {
      localStorage.setItem("neuralbuzz_player_id", playerId);
      localStorage.setItem("neuralbuzz_player_name", playerName);
    }
    const res = await fetch("/api/join-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode.toUpperCase(), playerName: playerName.trim(), playerId }),
    });
    const data = await res.json();
    if (data.success) {
      router.push(`/play/${joinCode.toUpperCase()}?playerId=${playerId}`);
    } else {
      setError(data.error || "Failed to join. Check the room code.");
      setLoading(false);
    }
  };

  const features = [
    { icon: "🤖", label: "AI Topics", desc: "LLMs, RAG, RLHF, CV" },
    { icon: "⚡", label: "Speed Bonus", desc: "Faster = more points" },
    { icon: "🔥", label: "Streak Bonus", desc: "+20% for 3-in-a-row" },
    { icon: "⚔️", label: "Elimination", desc: "Bottom 20% cut out" },
  ];

  return (
    <div className="page">
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>🧠</div>
        <h1 className="logo" style={{ fontSize: "clamp(2.2rem, 6vw, 3.5rem)", marginBottom: "0.75rem" }}>
          <span className="logo-neural">Neural</span>
          <span className="logo-buzz"> Buzz</span>
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1rem", maxWidth: 380, margin: "0 auto" }}>
          Live AI knowledge challenge. Test your AI IQ against up to 100 players.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1rem", flexWrap: "wrap" }}>
          <span className="badge badge-primary">Real-time</span>
          <span className="badge badge-warning">100 players</span>
          <span className="badge badge-success">AI-themed</span>
          <span className="badge badge-danger">Elimination</span>
        </div>
      </div>

      {view === "home" && (
        <div className="card slide-up" style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <button className="btn btn-accent" style={{ width: "100%", fontSize: "1.1rem", padding: "1rem" }} onClick={hostGame} disabled={loading}>
            {loading ? "Creating room..." : "Host a Game"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setView("join")}>
            Join with Code
          </button>
          {error && <p style={{ color: "var(--danger)", textAlign: "center", fontSize: "0.9rem" }}>{error}</p>}
        </div>
      )}

      {view === "join" && (
        <div className="card slide-up" style={{ width: "100%", maxWidth: 440 }}>
          <h2 style={{ fontFamily: "Orbitron, monospace", fontSize: "1.2rem", textAlign: "center", marginBottom: "1.5rem" }}>Join Game</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.4rem", display: "block" }}>Your Name</label>
              <input className="input" placeholder="Enter your name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength={20} autoFocus onKeyDown={(e) => e.key === "Enter" && joinGame()} />
            </div>
            <div>
              <label style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.4rem", display: "block" }}>Room Code</label>
              <input className="input" placeholder="ABC123" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} style={{ fontFamily: "Orbitron, monospace", letterSpacing: "0.25em", fontSize: "1.3rem", textAlign: "center" }} onKeyDown={(e) => e.key === "Enter" && joinGame()} />
            </div>
            {error && (
              <p style={{ color: "var(--danger)", textAlign: "center", fontSize: "0.9rem", background: "rgba(239,68,68,0.1)", padding: "0.6rem", borderRadius: 8 }}>
                {error}
              </p>
            )}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.25rem" }} onClick={joinGame} disabled={loading || !playerName.trim() || joinCode.length < 4}>
              {loading ? "Joining..." : "Join Game"}
            </button>
            <button className="btn btn-outline" style={{ width: "100%" }} onClick={() => { setView("home"); setError(""); }}>
              Back
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: "2.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem", maxWidth: 540, width: "100%" }}>
        {features.map((f) => (
          <div key={f.label} className="card" style={{ textAlign: "center", padding: "0.85rem 0.75rem" }}>
            <div style={{ fontSize: "1.4rem" }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: "0.82rem", marginTop: "0.3rem" }}>{f.label}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginTop: "0.2rem" }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="page"><div style={{ color: "var(--text-muted)" }}>Loading...</div></div>}>
      <HomeInner />
    </Suspense>
  );
}