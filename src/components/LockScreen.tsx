import { useMemo, useRef, useState } from 'react';

interface LockScreenProps {
  onUnlock: () => void;
}

interface Chip {
  id: number;
  char: string;
  left: number;
  top: number;
  dx: number;
  dy: number;
  rot: number;
  dur: number;
  delay: number;
}

const PASSCODE = 'DANTE';

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function buildChips(): Chip[] {
  const passChars = PASSCODE.split('');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((c) => !passChars.includes(c));
  const digits = '0123456789'.split('');
  const decoys: string[] = [];
  for (let i = 0; i < 15; i++) {
    const source = Math.random() < 0.62 ? alphabet : digits;
    decoys.push(source[Math.floor(Math.random() * source.length)]);
  }

  const chars = [...passChars, ...decoys]
    .map((char, i) => ({ char, i }))
    .sort(() => Math.random() - 0.5);

  return chars.map(({ char, i }) => ({
    id: i,
    char,
    left: rand(3, 90),
    top: rand(6, 86),
    dx: rand(20, 55),
    dy: rand(14, 40) * (Math.random() < 0.5 ? 1 : -1),
    rot: rand(-8, 8),
    dur: rand(9, 16),
    delay: rand(0, 6),
  }));
}

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const chips = useMemo(buildChips, []);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [wrong, setWrong] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const wrongTimer = useRef<number | undefined>(undefined);

  const handleChip = (id: number, char: string) => {
    if (selected[id] || unlocking) return;
    if (char === PASSCODE[progress]) {
      const next = progress + 1;
      setSelected((prev) => ({ ...prev, [id]: true }));
      setProgress(next);
      if (next === PASSCODE.length) {
        setUnlocking(true);
        setTimeout(onUnlock, 700);
      }
    } else {
      setSelected({});
      setProgress(0);
      setWrong(true);
      window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setWrong(false), 450);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-office-bg overflow-hidden">
      <div
        className={`absolute inset-0 ${wrong ? 'animate-[lock-shake_0.45s_ease-in-out]' : ''}`}
        style={{ opacity: unlocking ? 0 : 1, transition: 'opacity 0.5s ease' }}
      >
        {chips.map((c) => {
          const isSelected = !!selected[c.id];
          return (
            <div
              key={c.id}
              className="absolute select-none"
              style={{
                left: `${c.left}%`,
                top: `${c.top}%`,
                animation: `lock-drift ${c.dur}s ease-in-out ${c.delay}s infinite`,
                animationPlayState: isSelected ? 'paused' : 'running',
              }}
            >
              <button
                type="button"
                onClick={() => handleChip(c.id, c.char)}
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl font-black transition-all duration-300 cursor-pointer active:scale-90 ${
                  isSelected
                    ? 'scale-110 bg-office-blue text-white border-office-blue shadow-lg'
                    : 'bg-card/50 border-border-color text-main hover:border-office-blue/50 hover:text-office-blue'
                }`}
              >
                {c.char}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}