import { useEffect, useRef, useState } from "react";
import type { RoundView } from "../contract";

interface Props {
  round: RoundView;
  busy: boolean;
  onSend: (text: string) => void;
  onGuess: (g: "human" | "ai") => void;
}

const ROUND_SECONDS = 90;

export default function ChatScreen({ round, busy, onSend, onGuess }: Props) {
  const [text, setText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const startedAt = useRef<number>(Date.now());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      setSecondsLeft(Math.max(0, ROUND_SECONDS - elapsed));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [round.messages.length, busy]);

  const turnsLeft = round.maxMessages - round.msgCount;
  const timesUp = secondsLeft <= 0;
  const canSend = !busy && !timesUp && turnsLeft > 0 && text.trim().length > 0;
  const canGuess = !busy;

  function submit() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <section className="chat-card">
      <div className="chat-topbar">
        <div className="chat-id">
          <span className="chat-av">🕵️</span>
          <span>Stranger</span>
        </div>
        <span className={`chat-timer ${secondsLeft <= 15 ? "danger" : ""}`}>
          {String(Math.floor(secondsLeft / 60))}:{String(secondsLeft % 60).padStart(2, "0")}
        </span>
      </div>

      <div ref={scrollRef} className="chat-body">
        <div className="chat-hint">You start the conversation</div>
        {round.messages.map((m, i) => (
          <div key={i} className={`chat-line ${m.role === "you" ? "you" : "them"}`}>
            {m.role === "them" && <span className="bot-ic">🤖</span>}
            <span className="chat-bubble">{m.text}</span>
            {m.role === "you" && <span className="you-ic">🙂</span>}
          </div>
        ))}
        {busy && (
          <div className="chat-line them">
            <span className="bot-ic">🤖</span>
            <span className="chat-bubble typing">
              <span className="dot1" /> <span className="dot2" /> <span className="dot3" />
            </span>
          </div>
        )}
      </div>

      <div className="chat-compose">
        <input
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={turnsLeft <= 0 ? "No messages left — make your guess" : "Type a message…"}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          disabled={busy || timesUp || turnsLeft <= 0}
        />
        <button className="chat-send" onClick={submit} disabled={!canSend} aria-label="Send">
          ➤
        </button>
      </div>

      <div className="chat-meta">
        {busy
          ? "Confirm in your wallet, then the stranger replies on-chain (~30s)…"
          : turnsLeft > 0
            ? `${turnsLeft} messages left · replies are computed on-chain`
            : "Make your call"}
      </div>

      <div className="guess-row">
        <button className="human" onClick={() => onGuess("human")} disabled={!canGuess}>
          🧑 It's a HUMAN
        </button>
        <button className="ai" onClick={() => onGuess("ai")} disabled={!canGuess}>
          🤖 It's an AI
        </button>
      </div>
    </section>
  );
}
