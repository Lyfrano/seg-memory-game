import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

const WORD_BANK = [
  "amber", "bloom", "cedar", "dusk", "echo",
  "forge", "glow", "haven", "iris", "jade",
  "kindle", "lunar", "marsh", "nova", "opal",
  "pine", "quest", "raven", "sage", "tide",
  "umber", "veil", "wisp", "azure", "birch",
  "coral", "dawn", "ember", "frost", "glint",
  "haze", "inlet", "knoll", "lark", "mist",
  "north", "orbit", "prism", "quill", "reef",
  "slope", "trove", "vale", "wren", "xenon",
  "yarrow", "zest", "flint", "grove", "haven",
];

const WORD_VISIBLE_MS = 2200;
const STAGGER_MS = 800;
const POOL_SIZE: Record<Difficulty, number> = { normal: 3, hard: 5 };

type Difficulty = "normal" | "hard";
type GameState = "idle" | "playing" | "over";
type CardState = "entering" | "hidden";
type Card = { id: number; word: string; state: CardState };

let uid = 0;

export default function App() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [cards, setCards] = useState<Card[]>([]); // [0]=newest(top), [last]=oldest(bottom)
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [shake, setShake] = useState(false);
  const [revealWord, setRevealWord] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const poolRef = useRef<string[]>([]);
  const poolIndexRef = useRef(0);
  const hideTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    hideTimers.current.forEach((t) => clearTimeout(t));
    hideTimers.current.clear();
    pendingTimers.current.forEach((t) => clearTimeout(t));
    pendingTimers.current = [];
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const addCard = useCallback((word: string) => {
    const id = ++uid;
    setCards((prev) => [{ id, word, state: "entering" }, ...prev]);

    const t = setTimeout(() => {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, state: "hidden" } : c))
      );
      hideTimers.current.delete(id);
    }, WORD_VISIBLE_MS);
    hideTimers.current.set(id, t);
  }, []);

  const pickWord = () => {
    if (poolIndexRef.current >= poolRef.current.length) {
      poolRef.current = [...WORD_BANK].sort(() => Math.random() - 0.5);
      poolIndexRef.current = 0;
    }
    return poolRef.current[poolIndexRef.current++];
  };

  const startGame = useCallback(() => {
    clearAllTimers();
    poolRef.current = [...WORD_BANK].sort(() => Math.random() - 0.5);
    poolIndexRef.current = 0;

    setCards([]);
    setScore(0);
    setMisses(0);
    setInput("");
    setFeedback(null);
    setRevealWord(null);
    setShake(false);
    setGameState("playing");

    const size = POOL_SIZE[difficulty];
    const words = Array.from({ length: size }, () => pickWord());

    words.forEach((word, i) => {
      const t = setTimeout(() => addCard(word), i * STAGGER_MS);
      pendingTimers.current.push(t);
    });

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [difficulty, addCard, clearAllTimers]);

  const handleSubmit = () => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed || cards.length === 0) return;

    const oldest = cards[cards.length - 1];

    if (trimmed === oldest.word.toLowerCase()) {
      // Cancel its hide-timer in case it was still entering
      const ht = hideTimers.current.get(oldest.id);
      if (ht) { clearTimeout(ht); hideTimers.current.delete(oldest.id); }

      setCards((prev) => prev.slice(0, -1));
      setScore((s) => s + 1);
      setFeedback("correct");

      // Add replacement word after a short pause
      const word = pickWord();
      const t = setTimeout(() => addCard(word), 350);
      pendingTimers.current.push(t);
    } else {
      setMisses((m) => m + 1);
      setFeedback("wrong");
      setShake(true);
      setTimeout(() => setShake(false), 450);
    }

    setInput("");
    setTimeout(() => setFeedback(null), 550);
    inputRef.current?.focus();
  };

  const handleGiveUp = () => {
    clearAllTimers();
    const oldest = cards.length > 0 ? cards[cards.length - 1].word : null;
    setRevealWord(oldest);
    setGameState("over");
  };

  const poolSize = POOL_SIZE[difficulty];

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-8 py-5 shrink-0 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Remember these</h1>

        {gameState !== "playing" && (
          <div
            className="flex items-center gap-1 rounded-xl p-1"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            {(["normal", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-150 capitalize"
                style={{
                  background: difficulty === d ? "rgba(255,255,255,0.25)" : "transparent",
                  color: "var(--primary-foreground)",
                  opacity: difficulty === d ? 1 : 0.55,
                }}
              >
                {d}
                <span className="ml-1.5 text-xs font-normal opacity-80">
                  ×{POOL_SIZE[d]}
                </span>
              </button>
            ))}
          </div>
        )}

        {gameState === "playing" && (
          <span className="text-sm font-semibold opacity-60 capitalize">
            {difficulty} · {poolSize} words
          </span>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Left — word card column */}
        <div
          className="shrink-0 flex flex-col justify-center p-5 gap-3"
          style={{ width: "38%", borderRight: "1px solid var(--border)" }}
        >
          {/* Idle placeholders */}
          {gameState === "idle" &&
            Array.from({ length: poolSize }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl"
                style={{
                  height: "88px",
                  background: "var(--card)",
                  opacity: 0.2 + i * 0.15,
                }}
              />
            ))}

          {/* Live cards */}
          <AnimatePresence initial={false}>
            {(gameState === "playing" || gameState === "over") &&
              cards.map((card, i) => {
                const isOldest = i === cards.length - 1;
                const isEntering = card.state === "entering";

                return (
                  <motion.div
                    key={card.id}
                    initial={{ y: -96, opacity: 0, scale: 0.86 }}
                    animate={{
                      y: 0,
                      opacity: 1,
                      scale: 1,
                      boxShadow: isOldest
                        ? "0 0 0 2px var(--accent), 0 4px 16px rgba(90,75,140,0.1)"
                        : "0 2px 8px rgba(90,75,140,0.06)",
                    }}
                    exit={{ x: -70, opacity: 0, scale: 0.88, transition: { duration: 0.22 } }}
                    transition={{ type: "spring", stiffness: 340, damping: 26 }}
                    className="shrink-0 rounded-2xl relative overflow-hidden flex items-center justify-center"
                    style={{ height: "88px", background: "var(--card)" }}
                  >
                    {/* Word text — only visible while entering */}
                    <AnimatePresence mode="wait">
                      {isEntering ? (
                        <motion.span
                          key="word"
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.35 } }}
                          className="text-xl font-extrabold select-none"
                          style={{ color: "var(--primary)" }}
                        >
                          {card.word}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="blank"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-2xl select-none"
                          style={{ color: "var(--muted-foreground)", opacity: 0.3 }}
                        >
                          ·
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Countdown bar — drains while word is visible */}
                    {isEntering && (
                      <motion.div
                        className="absolute bottom-0 left-0 h-[3px] rounded-full"
                        style={{ background: "var(--accent)" }}
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{
                          duration: WORD_VISIBLE_MS / 1000,
                          ease: "linear",
                        }}
                      />
                    )}
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>

        {/* Right — input area */}
        <div className="flex-1 flex flex-col items-center justify-center px-12 py-8">
          {gameState === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-8 max-w-sm w-full"
            >
              <div className="space-y-3">
                <p className="text-2xl font-extrabold text-foreground">How to play</p>
                <p className="text-muted-foreground leading-relaxed">
                  {poolSize} words will flash on the left — memorize them. Once they
                  disappear, type the{" "}
                  <span className="font-bold text-foreground">oldest</span> word you saw.
                  Each correct answer brings a new word.
                </p>
              </div>
              <button
                onClick={startGame}
                className="w-full bg-primary text-primary-foreground py-3 rounded-2xl text-lg font-extrabold hover:bg-accent active:scale-95 transition-all duration-150 shadow-sm"
              >
                Start Game
              </button>
            </motion.div>
          )}

          {gameState === "playing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-xs space-y-4"
            >
              <p className="text-center text-muted-foreground text-xs font-bold uppercase tracking-[0.18em]">
                Type the oldest word
              </p>

              <motion.div
                animate={shake ? { x: [-9, 9, -7, 7, -4, 4, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Write here"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full text-center text-2xl font-bold bg-transparent outline-none placeholder:text-muted-foreground/40"
                  style={{
                    borderBottom: `2.5px solid ${
                      feedback === "correct"
                        ? "#4ade80"
                        : feedback === "wrong"
                        ? "#f87171"
                        : "var(--muted-foreground)"
                    }`,
                    paddingBottom: "10px",
                    transition: "border-color 0.18s",
                    color: "var(--foreground)",
                  }}
                />
              </motion.div>

              <div className="h-6 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {feedback === "correct" && (
                    <motion.span
                      key="c"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-green-500 font-bold text-sm tracking-wide"
                    >
                      ✓ Correct!
                    </motion.span>
                  )}
                  {feedback === "wrong" && (
                    <motion.span
                      key="w"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 font-bold text-sm tracking-wide"
                    >
                      ✗ Not quite
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={handleSubmit}
                className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-extrabold hover:bg-accent active:scale-95 transition-all duration-150 shadow-sm"
              >
                Submit
              </button>

              <button
                onClick={handleGiveUp}
                className="w-full py-2.5 rounded-2xl font-semibold text-sm text-muted-foreground hover:bg-muted/40 active:scale-95 transition-all duration-150"
                style={{ border: "1.5px solid var(--border)" }}
              >
                Give Up
              </button>
            </motion.div>
          )}

          {gameState === "over" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 max-w-xs w-full"
            >
              <div className="space-y-1">
                <p className="text-5xl font-extrabold text-foreground">{score}</p>
                <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest">
                  words recalled
                </p>
              </div>

              {misses > 0 && (
                <p className="text-muted-foreground text-sm">
                  {misses} missed attempt{misses !== 1 ? "s" : ""}
                </p>
              )}

              {revealWord && (
                <div
                  className="rounded-2xl px-8 py-5"
                  style={{ background: "var(--card)" }}
                >
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-2">
                    The oldest word was
                  </p>
                  <p className="text-3xl font-extrabold text-primary">{revealWord}</p>
                </div>
              )}

              <button
                onClick={startGame}
                className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-extrabold hover:bg-accent active:scale-95 transition-all duration-150 shadow-sm"
              >
                Play Again
              </button>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="shrink-0 px-8 py-4 flex items-center justify-between"
        style={{ background: "var(--primary)" }}
      >
        <div className="flex gap-6 text-sm font-bold text-primary-foreground">
          <span>
            Score: <span className="text-base">{score}</span>
          </span>
          {misses > 0 && (
            <span style={{ opacity: 0.6 }}>Missed: {misses}</span>
          )}
        </div>
        {gameState === "playing" && (
          <span
            className="text-sm font-semibold text-primary-foreground"
            style={{ opacity: 0.55 }}
          >
            {difficulty} mode
          </span>
        )}
      </footer>
    </div>
  );
}
