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
  startRound,
} from "./contract";
import WalletBar from "./components/WalletBar";
import WalletPicker from "./components/WalletPicker";
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
  const [picker, setPicker] = useState<DetectedWallet[] | null>(null);

  const clientRef = useRef<ReturnType<typeof makeClient> | null>(null);
  const readClientRef = useRef<ReturnType<typeof makeReadClient> | null>(null);
  if (!readClientRef.current) readClientRef.current = makeReadClient();

  const refresh = useCallback(async () => {
    const readClient = readClientRef.current!;
    // Leaderboard is public — always show it, even before connecting.
    try {
      setBoard(await getLeaderboard(readClient));
    } catch (e) {
      console.warn("leaderboard read failed", e);
    }

    const client = clientRef.current;
    if (!client || !account) return;
    try {
      const [r, sc] = await Promise.all([
        getMyRound(client, account),
        getScore(client, account),
      ]);
      setRound(r);
      setScore(sc);
    } catch (e) {
      console.warn("read failed", e);
    }
  }, [account]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 6000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function openConnect() {
    setError(null);
    const wallets = await discoverWallets();
    if (wallets.length === 1) {
      await connectTo(wallets[0]);
      return;
    }
    setPicker(wallets);
  }

  async function connectTo(w: DetectedWallet) {
    setPicker(null);
    setError(null);
    try {
      const address = await requestAccounts(w.provider);
      const client = makeClient(w.provider, address);
      clientRef.current = client;
      setAccount(address);
      // Track account switches in the wallet.
      w.provider.on?.("accountsChanged", (accs: string[]) => {
        if (!accs || accs.length === 0) {
          setAccount(null);
          clientRef.current = null;
        } else {
          const next = accs[0] as Hex;
          clientRef.current = makeClient(w.provider, next);
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
    const seed = account.slice(2, 10);
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

  const connected = !!account;
  const inActiveRound = !!round?.active && !round.resolved;
  const ctaLabel = !connected
    ? "Connect wallet to play"
    : busy
      ? "Working…"
      : round?.resolved
        ? "Play again (0.0001 GEN)"
        : "Play a round (0.0001 GEN)";

  function heroAction() {
    if (!connected) return openConnect();
    return handleStart();
  }

  return (
    <div className="app">
      <WalletBar address={account} score={score} onConnect={openConnect} />

      {!inActiveRound && <Hero onStart={heroAction} busy={busy} ctaLabel={ctaLabel} />}

      {error && <div className="error">{error}</div>}

      {connected && inActiveRound && (
        <RoundScreen round={round} busy={busy} onGuess={handleGuess} />
      )}

      {connected && (
        <ResultCard round={round} onPlayAgain={handleStart} busy={busy} />
      )}

      <Leaderboard rows={board} me={account} />

      <div className="foot">
        Mimic · built on GenLayer · Intelligent Contract in Python · genlayer-js · connect
        MetaMask, OKX, Rabby, or any wallet
      </div>

      {picker && (
        <WalletPicker
          wallets={picker}
          onPick={connectTo}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
