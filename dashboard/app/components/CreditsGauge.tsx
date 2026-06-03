'use client';

import { useEffect, useState } from 'react';

type Props = {
  used: number;
  total: number;
  size?: number;
};

export default function CreditsGauge({ used, total, size = 160 }: Props) {
  const [animatedUsed, setAnimatedUsed] = useState(0);
  const pct = total > 0 ? Math.min((animatedUsed / total) * 100, 100) : 0;
  const remaining = Math.max(total - used, 0);

  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color = pct < 40 ? '#22c55e' : pct < 80 ? '#eab308' : '#ef4444';

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedUsed(used), 100);
    return () => clearTimeout(timer);
  }, [used]);

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="text-center -mt-16">
        <p className="text-2xl font-bold">{remaining}</p>
        <p className="text-xs text-gray-400">/ {total} credits</p>
      </div>
    </div>
  );
}
