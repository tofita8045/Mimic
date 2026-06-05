import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionView } from "../contract";

interface Props {
  session: SessionView | null;
  busy: boolean;
  onSend: (text: string) => void;
  onGuess: (g: "human" | "ai") => void;
}

const ROUND_SECONDS = 60;

interface ChatTurn {
  player: string;
  opponent: string;
}

function parseTranscript(transcript: string): ChatTurn[] {
  if (!transcript) return [];
  const turns: ChatTurn[] = [];
  const lines = transcript.split("\n");
  let currentPlayer = "";
  for (const raw of lines) {
    if (raw.startsWith("P: ")) {
      currentPlayer = raw.slice(3);
    } else if (raw.startsWith("O: ")) {
      turns.push({ player: currentPlayer, opponent: raw.slice(3) });
      currentPlayer = "";
    }
  }
  return turns;
}

export default function GameScreen({ session, busy, onSend, onGuess }: Props) {
  const [text, setText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const startedAtRef = useRef<number | null>(null);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);

  const active = !!session?.active;
  const resolved = !!session?.resolved;
  const turns = session?.turns ?? 0;
  const maxTurns = session?.max_turns ?? 8;
  const turnsLeft = Math.max(0, maxTurns - turns);
  const chat = useMemo(() => parseTranscript(session?.transcript ?? ""), [session?.transcript]);

  // Reset the 60s timer each fresh, unresolved round.
  useEffect(() => {
    if (active && !resolved && startedAtRef.current === null) {
      startedAtRef.current = Date.now();
      setSecondsLeft(ROUND_SECONDS);
    }
    if (!active || resolved) startedAtRef.current = null;
  }, [active, resolved]);

  useEffect(() => {
    if (!active || resolved || startedAtRef.current === null) return;
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000);
      setSecondsLeft(Math.max(0, ROUND_SECONDS - elapsed));
    }, 250);
    return () => window.clearInterval(id);
  }, [active, resolved]);

  useEffect(() => {
    const el = transcriptBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, busy]);

  const timesUp = secondsLeft <= 0;
  const turnsExhausted = turnsLeft <= 0;
  const canSend =
    active && !resolved && !busy && !timesUp && !turnsExhausted && text.trim().length > 0;
  const canGuess = active && !resolved && !busy;

  function submitMessage() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  }

  if (!active) return null;

  return (
    <section className="surface">
      <div className="chat-head">
        <div className="who">
          <div className="av">?</div>
          <div>
            <div>Stranger</div>
            <div className="muted" style={{ fontSize: 12 }}>persona hidden until you guess</div>
          </div>
        </div>
        <span className={`timer ${secondsLeft <= 10 ? "danger" : ""}`}>
          {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
          {String(secondsLeft % 60).padStart(2, "0")} · {turns}/{maxTurns}
        </span>
      </div>

      <div ref={transcriptBoxRef} className="transcript">
        {chat.length === 0 && !busy ? (
          <div className="placeholder">Say hi to break the ice…</div>
        ) : (
          chat.map((t, i) => (
            <div key={i}>
              <div className="row-bub me"><div className="bubble me">{t.player}</div></div>
              <div className="row-bub them"><div className="bubble them">{t.opponent}</div></div>
            </div>
          ))
        )}
        {busy && (
          <div className="row-bub them"><div className="bubble them"><span className="spinner" />…</div></div>
        )}
      </div>

      <div className="compose">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={timesUp ? "Time's up — make your guess." : "Type a message…"}
          onKeyDown={(e) => { if (e.key === "Enter") submitMessage(); }}
          disabled={!active || resolved || busy || timesUp || turnsExhausted}
        />
        <button onClick={submitMessage} disabled={!canSend}>Send</button>
      </div>

      <div className="guess-row">
        <button className="human" onClick={() => onGuess("human")} disabled={!canGuess}>
          🧑 Guess HUMAN
        </button>
        <button className="ai" onClick={() => onGuess("ai")} disabled={!canGuess}>
          🤖 Guess AI
        </button>
      </div>

      {turnsExhausted && (
        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}>
          Turn limit reached — make your guess.
        </p>
      )}
    </section>
  );
}
