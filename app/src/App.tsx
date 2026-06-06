import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";
import {
  DetectedWallet,
  Hex,
  discoverWallets,
  makeClient,
  makeReadClient,
  requestAccounts,
} from "./genlayer";
import {
  Address,
  LeaderboardRow,
  RoundView,
  getLeaderboard,
  getMyRound,
  getScore,
  makeGuess,
  sendMessage,
  startRound,
} from "./contract";
import WalletBar from "./components/WalletBar";
import WalletPicker from "./components/WalletPicker";
import Hero from "./components/Hero";
import ChatScreen from "./components/ChatScreen";
import ResultScreen from "./components/ResultScreen";
import Leaderboard from "./components/Leaderboard";

export default function App() {
  const [account, setAccount] = useState<Address | null>(null);
  const [round, setRound] = useState<RoundView | null>(null);
  const [score, setScore] = useState<number>(0);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<DetectedWallet[] | null>(null);

  // "idle" | "playing" | "result" — controls which screen shows.
  // The result screen persists until the player explicitly starts a New Game.
  const [view, setView] = useState<"idle" | "playing" | "result">("idle");

  const clientRef = useRef<ReturnType<typeof makeClient> | null>(null);
  const readClientRef = useRef<ReturnType<typeof makeReadClient> | null>(null);
  if (!readClientRef.current) readClientRef.current = makeReadClient();

  const refreshLeaderboard = useCallback(async () => {
    try {
      setBoard(await getLeaderboard(readClientRef.current!));
    } catch (e) {
      console.warn("leaderboard read failed", e);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    if (!account) return null;
    // Reads go through the read-only client (no wallet round-trips, more reliable).
    const client = readClientRef.current!;
    try {
      const [r, sc] = await Promise.all([
        getMyRound(client, account),
        getScore(client, account),
      ]);
      setRound(r);
      setScore(sc);
      return r;
    } catch (e) {
      console.warn("read failed", e);
      return null;
    }
  }, [account]);

  useEffect(() => {
    refreshLeaderboard();
    const id = window.setInterval(refreshLeaderboard, 8000);
    return () => window.clearInterval(id);
  }, [refreshLeaderboard]);

  // When a wallet connects, hydrate the player's current round once.
  useEffect(() => {
    if (!account) return;
    (async () => {
      const r = await refreshMe();
      if (r?.active && !r.resolved) setView("playing");
      else if (r?.active && r.resolved) setView("result");
      else setView("idle");
    })();
  }, [account, refreshMe]);

  async function openConnect() {
    setError(null);
    const wallets = await discoverWallets();
    if (wallets.length === 1) return connectTo(wallets[0]);
    setPicker(wallets);
  }

  async function connectTo(w: DetectedWallet) {
    setPicker(null);
    setError(null);
    try {
      const address = await requestAccounts(w.provider);
      const client = makeClient(w.provider, address);
      // Switch the wallet to Studionet ONCE here (not on every transaction).
      try {
        await client.connect("studionet");
      } catch (e) {
        console.warn("connect() failed", e);
      }
      clientRef.current = client;
      setAccount(address);
      w.provider.on?.("accountsChanged", async (accs: string[]) => {
        if (!accs || accs.length === 0) {
          setAccount(null);
          clientRef.current = null;
        } else {
          const next = accs[0] as Hex;
          const c = makeClient(w.provider, next);
          try { await c.connect("studionet"); } catch {}
          clientRef.current = c;
          setAccount(next);
        }
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to connect wallet.");
    }
  }

  async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e: any) {
      const msg: string = e?.shortMessage ?? e?.message ?? String(e);
      if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("denied")) {
        setError("Transaction cancelled.");
      } else if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("balance")) {
        setError("Not enough GEN for the entry fee. Top up via the Studionet faucet (💧).");
      } else {
        setError(msg);
      }
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!clientRef.current || !account) return;
    const seed = account.slice(2, 10) + Date.now().toString(36);
    setView("playing");
    setRound({ active: true, resolved: false, messages: [], msgCount: 0, maxMessages: 6, guess: "", persona: "", correct: false });
    const ok = await withBusy(async () => {
      await startRound(clientRef.current!, seed);
      await refreshMe();
      return true;
    });
    if (!ok) setView("idle");
  }

  async function handleSend(text: string) {
    if (!clientRef.current) return;
    const prevCount = round?.messages.length ?? 0;
    // Optimistically show the player's message right away.
    setRound((prev) =>
      prev ? { ...prev, messages: [...prev.messages, { role: "you", text }] } : prev,
    );
    await withBusy(async () => {
      await sendMessage(clientRef.current!, text);
      // The on-chain read can lag behind the accepted tx — poll until the
      // transcript grows (i.e. the opponent's reply landed).
      for (let i = 0; i < 15; i++) {
        const r = await refreshMe();
        if (r && r.messages.length > prevCount + 1) return;
        await new Promise((res) => setTimeout(res, 2000));
      }
    });
  }

  async function handleGuess(g: "human" | "ai") {
    if (!clientRef.current) return;
    const r = await withBusy(async () => {
      await makeGuess(clientRef.current!, g);
      const updated = await refreshMe();
      await refreshLeaderboard();
      return updated;
    });
    if (r?.resolved) setView("result");
  }

  function handleNewGame() {
    setRound(null);
    setView("idle");
    handleStart();
  }

  const connected = !!account;
  const showHero = view === "idle";

  return (
    <div className="app">
      <WalletBar address={account} score={score} onConnect={openConnect} />

      {showHero && (
        <Hero
          onStart={connected ? handleStart : openConnect}
          busy={busy}
          ctaLabel={connected ? "Play a round (0.0001 GEN)" : "Connect wallet to play"}
        />
      )}

      {error && <div className="error">{error}</div>}

      {connected && view === "playing" && round && (
        <ChatScreen round={round} busy={busy} onSend={handleSend} onGuess={handleGuess} />
      )}

      {connected && view === "result" && round && (
        <ResultScreen round={round} busy={busy} onNewGame={handleNewGame} />
      )}

      <Leaderboard rows={board} me={account} />

      <div className="foot">
        Mimic · built on GenLayer · Intelligent Contract in Python · genlayer-js
      </div>

      {picker && (
        <WalletPicker wallets={picker} onPick={connectTo} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}
