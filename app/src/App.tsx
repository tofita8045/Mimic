import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";
import { makeClient, resetIdentity } from "./genlayer";
import {
  Address,
  LeaderboardRow,
  RoundView,
  getLeaderboard,
  getMyRound,
  getScore,
  makeGuess,
  startRound,
} from "./contract";
import WalletBar from "./components/WalletBar";
import Hero from "./components/Hero";
import RoundScreen from "./components/RoundScreen";
import ResultCard from "./components/ResultCard";
import Leaderboard from "./components/Leaderboard";

export default function App() {
  const [account, setAccount] = useState<Address | null>(null);
  const [round, setRound] = useState<RoundView | null>(null);
  const [score, setScore] = useState<number>(0);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<ReturnType<typeof makeClient>["client"] | null>(null);

  // Create (or restore) the local burner identity on first load — zero clicks,
  // no wallet extension required.
  useEffect(() => {
    const { client, address } = makeClient();
    clientRef.current = client;
    setAccount(address);
  }, []);

  const refresh = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !account) return;
    try {
      const [b, r, sc] = await Promise.all([
        getLeaderboard(client),
        getMyRound(client, account),
        getScore(client, account),
      ]);
      setBoard(b);
      setRound(r);
      setScore(sc);
    } catch (e) {
      console.warn("read failed", e);
    }
  }, [account]);

  useEffect(() => {
    if (!account) return;
    refresh();
    const id = window.setInterval(refresh, 6000);
    return () => window.clearInterval(id);
  }, [refresh, account]);

  async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e: any) {
      const msg: string = e?.shortMessage ?? e?.message ?? String(e);
      if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("balance")) {
        setError("This identity has no GEN yet. Tap “Fund me” to get test tokens.");
      } else {
        setError(msg);
      }
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!clientRef.current) return;
    const seed = (account ?? "0x0").slice(2, 10);
    await withBusy(async () => {
      await startRound(clientRef.current!, seed);
      await refresh();
    });
  }

  async function handleGuess(g: "human" | "ai") {
    if (!clientRef.current) return;
    await withBusy(async () => {
      await makeGuess(clientRef.current!, g);
      await refresh();
    });
  }

  function handleNewIdentity() {
    resetIdentity();
    const { client, address } = makeClient();
    clientRef.current = client;
    setAccount(address);
    setRound(null);
    setScore(0);
  }

  const inActiveRound = !!round?.active && !round.resolved;
  const ctaLabel = busy ? "Drawing a sentence…" : round?.resolved ? "Play again" : "Show me a sentence";

  return (
    <div className="app">
      <WalletBar address={account} score={score} onNewIdentity={handleNewIdentity} />

      {!inActiveRound && <Hero onStart={handleStart} busy={busy} ctaLabel={ctaLabel} />}

      {error && <div className="error">{error}</div>}

      {inActiveRound && <RoundScreen round={round} busy={busy} onGuess={handleGuess} />}

      <ResultCard round={round} onPlayAgain={handleStart} busy={busy} />
      <Leaderboard rows={board} me={account} />

      <div className="foot">
        Mimic · built on GenLayer · Intelligent Contract in Python · genlayer-js · no wallet needed
      </div>
    </div>
  );
}
