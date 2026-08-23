import React, { useEffect, useState, useRef } from "react";

interface FlipDigitProps {
  digit: string;
}

export const FlipDigitCard: React.FC<FlipDigitProps> = ({ digit }) => {
  const [current, setCurrent] = useState(digit);
  const [previous, setPrevious] = useState(digit);
  const [isFlipping, setIsFlipping] = useState(false);
  const prevDigitRef = useRef(digit);

  useEffect(() => {
    if (digit !== prevDigitRef.current) {
      setPrevious(prevDigitRef.current);
      setCurrent(digit);
      prevDigitRef.current = digit;
      setIsFlipping(true);

      const timer = setTimeout(() => {
        setIsFlipping(false);
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [digit]);

  return (
    <div
      className="relative w-7 sm:w-8 h-10 sm:h-11 bg-[#121212] rounded-[4px] shadow-[0_2px_8px_rgba(0,0,0,0.4)] select-none text-white font-mono font-bold text-base sm:text-lg"
      style={{ perspective: "400px" }}
    >
      {/* 1. Static Upper Half (Shows NEW / CURRENT digit) */}
      <div className="absolute top-0 inset-x-0 h-[50%] bg-[#1c1c1c] rounded-t-[4px] overflow-hidden border-t border-x border-[#2c2c2c] border-b border-[#0a0a0a]">
        <div className="w-full h-10 sm:h-11 flex items-center justify-center -translate-y-0 text-[#f0f0f0]">
          {current}
        </div>
        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/15" />
      </div>

      {/* 2. Static Lower Half (Shows PREVIOUS or CURRENT digit) */}
      <div className="absolute bottom-0 inset-x-0 h-[50%] bg-[#161616] rounded-b-[4px] overflow-hidden border-b border-x border-[#242424]">
        <div className="w-full h-10 sm:h-11 flex items-center justify-center -translate-y-[50%] text-[#e0e0e0]">
          {isFlipping ? previous : current}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
      </div>

      {/* Center Dividing Notch & Seam Line */}
      <div className="absolute top-[50%] -translate-y-1/2 inset-x-0 h-[1px] bg-[#080808] z-40 flex items-center justify-between pointer-events-none">
        <div className="w-1 h-1.5 bg-[#0a0a0a] rounded-r-full -ml-[1px] border-r border-black" />
        <div className="w-1 h-1.5 bg-[#0a0a0a] rounded-l-full -mr-[1px] border-l border-black" />
      </div>

      {/* 3. Flipping Upper Leaf (Flips Down from top) */}
      {isFlipping && (
        <div
          className="absolute top-0 inset-x-0 h-[50%] bg-[#1c1c1c] rounded-t-[4px] overflow-hidden border-t border-x border-[#2c2c2c] border-b border-[#0a0a0a] z-30 origin-bottom"
          style={{
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            animation: "flipUpperLeaf 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        >
          <div className="w-full h-10 sm:h-11 flex items-center justify-center text-[#f0f0f0]">
            {previous}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
        </div>
      )}

      {/* 4. Flipping Lower Leaf (Flips Down into place) */}
      {isFlipping && (
        <div
          className="absolute bottom-0 inset-x-0 h-[50%] bg-[#161616] rounded-b-[4px] overflow-hidden border-b border-x border-[#242424] z-20 origin-top"
          style={{
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            animation: "flipLowerLeaf 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        >
          <div className="w-full h-10 sm:h-11 flex items-center justify-center -translate-y-[50%] text-[#e0e0e0]">
            {current}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-black/30" />
        </div>
      )}
    </div>
  );
};

export const FlipGroup: React.FC<{ value: number; label: string }> = ({
  value,
  label,
}) => {
  const str = String(Math.max(0, value)).padStart(2, "0");
  const d1 = str[0];
  const d2 = str[1];

  return (
    <div className="flex flex-col items-center space-y-1">
      <div className="flex items-center space-x-1">
        <FlipDigitCard digit={d1} />
        <FlipDigitCard digit={d2} />
      </div>
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#888888] font-sans">
        {label}
      </span>
    </div>
  );
};

interface FlipCountdownProps {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  language: "zh" | "en";
}

export const FlipCountdown: React.FC<FlipCountdownProps> = ({
  days,
  hours,
  minutes,
  seconds,
  language,
}) => {
  return (
    <div
      id="flip-countdown-timer"
      className="inline-flex items-center bg-[#0a0a0a] p-2.5 sm:p-3 rounded-lg border border-[#222222] shadow-[0_4px_24px_rgba(0,0,0,0.35)] space-x-2 sm:space-x-3 shrink-0"
    >
      <FlipGroup
        value={days}
        label={language === "zh" ? "天" : "DAYS"}
      />

      <div className="flex flex-col space-y-1.5 pb-3">
        <span className="w-1 h-1 rounded-full bg-[#666666] shadow-xs" />
        <span className="w-1 h-1 rounded-full bg-[#666666] shadow-xs" />
      </div>

      <FlipGroup
        value={hours}
        label={language === "zh" ? "时" : "HRS"}
      />

      <div className="flex flex-col space-y-1.5 pb-3">
        <span className="w-1 h-1 rounded-full bg-[#666666] shadow-xs" />
        <span className="w-1 h-1 rounded-full bg-[#666666] shadow-xs" />
      </div>

      <FlipGroup
        value={minutes}
        label={language === "zh" ? "分" : "MIN"}
      />

      <div className="flex flex-col space-y-1.5 pb-3">
        <span className="w-1 h-1 rounded-full bg-[#666666] shadow-xs" />
        <span className="w-1 h-1 rounded-full bg-[#666666] shadow-xs" />
      </div>

      <FlipGroup
        value={seconds}
        label={language === "zh" ? "秒" : "SEC"}
      />
    </div>
  );
};
