import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";
import { connectWallet, makeClient } from "./genlayer";
import {
  Address,
  LeaderboardRow,
  RoundView,
  clearSavedAddress,
  deployContract,
  getLeaderboard,
  getMyRound,
  getSavedAddress,
  getScore,
  makeGuess,
  setSavedAddress,
  startRound,
} from "./contract";
import { MIMIC_SOURCE } from "./contractSource";
import WalletBar from "./components/WalletBar";
import Hero from "./components/Hero";
import RoundScreen from "./components/RoundScreen";
import ResultCard from "./components/ResultCard";
import Leaderboard from "./components/Leaderboard";

export default function App() {
  const [account, setAccount] = useState<Address | null>(null);
  const [contractAddress, setContractAddress] = useState<Address | null>(getSavedAddress());
  const [addressInput, setAddressInput] = useState<string>("");
  const [round, setRound] = useState<RoundView | null>(null);
  const [score, setScore] = useState<number>(0);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<ReturnType<typeof makeClient> | null>(null);

  const refresh = useCallback(async () => {
    if (!contractAddress) return;
    try {
      const client = clientRef.current ?? (account ? makeClient(account) : null);
      if (!client) return;
      const [board, r, sc] = await Promise.all([
        getLeaderboard(client, contractAddress),
        account ? getMyRound(client, contractAddress, account) : Promise.resolve(null),
        account ? getScore(client, contractAddress, account) : Promise.resolve(0),
      ]);
      setBoard(board);
      setRound(r);
      setScore(sc);
    } catch (e) {
      console.warn("read failed", e);
    }
  }, [account, contractAddress]);

  useEffect(() => { if (account) clientRef.current = makeClient(account); }, [account]);

  useEffect(() => {
    refresh();
    if (!contractAddress) return;
    const id = window.setInterval(refresh, 6000);
    return () => window.clearInterval(id);
  }, [refresh, contractAddress]);

  async function onConnect() {
    setError(null);
    try {
      setAccount(await connectWallet());
    } catch (e: any) {
      setError(e?.message ?? "Failed to connect wallet.");
    }
  }

  function saveContractAddress() {
    const v = addressInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(v)) {
      setError("That doesn't look like a valid contract address.");
      return;
    }
    setSavedAddress(v);
    setContractAddress(v as Address);
    setAddressInput("");
    setError(null);
  }

  function changeContractAddress() {
    clearSavedAddress();
    setContractAddress(null);
    setRound(null);
    setBoard([]);
  }

  async function handleDeploy() {
    if (!account || !clientRef.current) return;
    await withBusy(async () => {
      const addr = await deployContract(clientRef.current!, MIMIC_SOURCE);
      setSavedAddress(addr);
      setContractAddress(addr);
      await refresh();
    });
  }

  async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try { return await fn(); }
    catch (e: any) {
      const msg: string = e?.shortMessage ?? e?.message ?? String(e);
      if (msg.toLowerCase().includes("user rejected")) setError("Transaction cancelled.");
      else if (msg.toLowerCase().includes("insufficient"))
        setError("Insufficient GEN. Use the 💧 faucet in the Studio account selector.");
      else setError(msg);
      return undefined;
    }
    finally { setBusy(false); }
  }

  async function handleStart() {
    if (!account || !contractAddress || !clientRef.current) return;
    const seed = account.slice(2, 10);
    await withBusy(async () => {
      await startRound(clientRef.current!, contractAddress, seed);
      await refresh();
    });
  }

  async function handleGuess(g: "human" | "ai") {
    if (!account || !contractAddress || !clientRef.current) return;
    await withBusy(async () => {
      await makeGuess(clientRef.current!, contractAddress, g);
      await refresh();
    });
  }

  const inActiveRound = !!round?.active && !round.resolved;
  const ctaLabel = !account
    ? "Connect wallet to play"
    : !contractAddress
      ? "Add contract address"
      : round?.resolved
        ? "Play again"
        : busy
          ? "Drawing a sentence…"
          : "Show me a sentence";

  function heroAction() {
    if (!account) return onConnect();
    if (!contractAddress) return; // banner already shown
    return handleStart();
  }

  return (
    <div className="app">
      <WalletBar address={account} score={score} onConnect={onConnect} />

      {!inActiveRound && (
        <Hero
          onStart={heroAction}
          busy={busy}
          ctaLabel={ctaLabel}
          disabled={!!account && !contractAddress}
        />
      )}

      {!contractAddress && (
        <div className="banner">
          <span>
            <strong>One-time setup:</strong> deploy the Mimic contract to GenLayer Studionet,
            then start playing. No Studio UI needed — your wallet signs the deploy.
          </span>
          <button className="cta" onClick={handleDeploy} disabled={!account || busy}>
            {busy ? <span className="spinner" /> : null}
            {account ? "Deploy contract" : "Connect wallet first"}
          </button>
          <details style={{ width: "100%", marginTop: 6 }}>
            <summary className="muted" style={{ cursor: "pointer" }}>
              Already deployed? Paste the address.
            </summary>
            <div className="row" style={{ marginTop: 8 }}>
              <input
                className="input col"
                placeholder="0x…"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
              />
              <button onClick={saveContractAddress}>Save</button>
            </div>
          </details>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {account && contractAddress && inActiveRound && (
        <RoundScreen round={round} busy={busy} onGuess={handleGuess} />
      )}

      {account && contractAddress && (
        <>
          <ResultCard round={round} onPlayAgain={handleStart} busy={busy} />
          <Leaderboard rows={board} me={account} />
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button className="ghost" onClick={changeContractAddress}>Change contract</button>
          </div>
        </>
      )}

      <div className="foot">Mimic · built on GenLayer · Intelligent Contracts in Python · genlayer-js</div>
    </div>
  );
}
