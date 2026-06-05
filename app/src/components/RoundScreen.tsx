import { useEffect, useRef, useState } from "react";
import type { RoundView } from "../contract";

interface Props {
  round: RoundView | null;
  busy: boolean;
  onGuess: (g: "human" | "ai") => void;
}

const ROUND_SECONDS = 60;

export default function RoundScreen({ round, busy, onGuess }: Props) {
  const active = !!round?.active;
  const resolved = !!round?.resolved;

  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const startedAtRef = useRef<number | null>(null);

  // (Re)start the 60s timer each time a fresh, unresolved round shows up.
  useEffect(() => {
    if (active && !resolved) {
      startedAtRef.current = Date.now();
      setSecondsLeft(ROUND_SECONDS);
    } else {
      startedAtRef.current = null;
    }
  }, [active, resolved, round?.sentence]);

  useEffect(() => {
    if (!active || resolved || startedAtRef.current === null) return;
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000);
      setSecondsLeft(Math.max(0, ROUND_SECONDS - elapsed));
    }, 250);
    return () => window.clearInterval(id);
  }, [active, resolved]);

  if (!active || resolved) return null;

  const canGuess = !busy;

  return (
    <section className="surface">
      <div className="chat-head">
        <div className="who">
          <div className="av">?</div>
          <div>
            <div>Stranger said…</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Was it a human, or an AI mimicking one?
            </div>
          </div>
        </div>
        <span className={`timer ${secondsLeft <= 10 ? "danger" : ""}`}>
          {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
          {String(secondsLeft % 60).padStart(2, "0")}
        </span>
      </div>

      <div className="quote">
        <span className="quote-mark">“</span>
        <p>{round?.sentence ?? "…"}</p>
      </div>

      <div className="guess-row">
        <button className="human" onClick={() => onGuess("human")} disabled={!canGuess}>
          🧑 Guess HUMAN
        </button>
        <button className="ai" onClick={() => onGuess("ai")} disabled={!canGuess}>
          🤖 Guess AI
        </button>
      </div>
    </section>
  );
}
