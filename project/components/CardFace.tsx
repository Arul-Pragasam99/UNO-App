'use client';

import { Card, CardColor } from '@/lib/types';

interface CardFaceProps {
  card: Card;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

/** Original copyright-free SVG card face designs */
const CardFace = ({ card, size = 'md' }: CardFaceProps) => {
  const sizeMap = {
    xs: { w: 48, h: 72, fontSize: 16, cornerSize: 8, iconSize: 24 },
    sm: { w: 56, h: 84, fontSize: 20, cornerSize: 9, iconSize: 28 },
    md: { w: 72, h: 108, fontSize: 26, cornerSize: 10, iconSize: 36 },
    lg: { w: 96, h: 144, fontSize: 36, cornerSize: 12, iconSize: 48 },
  };

  const s = sizeMap[size];
  const activeColor = card.chosenColor || (card.color !== 'wild' ? card.color : undefined);

  const colorMap: Record<string, { bg: string; accent: string; glow: string }> = {
    red: { bg: '#EF4444', accent: '#FCA5A5', glow: 'rgba(239,68,68,0.4)' },
    yellow: { bg: '#EAB308', accent: '#FDE68A', glow: 'rgba(234,179,8,0.4)' },
    blue: { bg: '#3B82F6', accent: '#93C5FD', glow: 'rgba(59,130,246,0.4)' },
    green: { bg: '#22C55E', accent: '#86EFAC', glow: 'rgba(34,197,94,0.4)' },
    wild: { bg: '#1F2937', accent: '#6B7280', glow: 'rgba(31,41,55,0.4)' },
  };

  const colors = colorMap[card.color] || colorMap.wild;

  const getValueDisplay = (): string => {
    switch (card.value) {
      case 'Skip': return '⊘';
      case 'Reverse': return '⇄';
      case 'DrawTwo': return '+2';
      case 'Wild': return '★';
      case 'DrawFour': return '+4';
      default: return card.value;
    }
  };

  const isActionCard = ['Skip', 'Reverse', 'DrawTwo', 'Wild', 'DrawFour'].includes(card.value);

  return (
    <svg
      width={s.w}
      height={s.h}
      viewBox={`0 0 ${s.w} ${s.h}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 2px 8px ${colors.glow})` }}
    >
      {/* Card body */}
      <rect
        x="0" y="0" width={s.w} height={s.h}
        rx={s.w * 0.1} ry={s.w * 0.1}
        fill={colors.bg}
      />

      {/* Inner white ellipse */}
      <ellipse
        cx={s.w / 2} cy={s.h / 2}
        rx={s.w * 0.38} ry={s.h * 0.4}
        fill="white"
        opacity="0.95"
        transform={`rotate(-15, ${s.w / 2}, ${s.h / 2})`}
      />

      {/* Wild card — four-color diamond */}
      {card.color === 'wild' && (
        <g transform={`translate(${s.w / 2}, ${s.h / 2})`}>
          <polygon points={`0,${-s.iconSize * 0.6} ${s.iconSize * 0.6},0 0,${s.iconSize * 0.6} ${-s.iconSize * 0.6},0`}>
            <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
          </polygon>
          {/* Four colored triangles */}
          <polygon points={`0,${-s.iconSize * 0.55} ${s.iconSize * 0.55},0 0,0`} fill="#EF4444" />
          <polygon points={`${s.iconSize * 0.55},0 0,${s.iconSize * 0.55} 0,0`} fill="#3B82F6" />
          <polygon points={`0,${s.iconSize * 0.55} ${-s.iconSize * 0.55},0 0,0`} fill="#22C55E" />
          <polygon points={`${-s.iconSize * 0.55},0 0,${-s.iconSize * 0.55} 0,0`} fill="#EAB308" />
        </g>
      )}

      {/* Center value */}
      <text
        x={s.w / 2}
        y={s.h / 2 + (isActionCard ? s.fontSize * 0.1 : s.fontSize * 0.35)}
        textAnchor="middle"
        fill={card.color === 'wild' ? 'white' : colors.bg}
        fontSize={s.fontSize}
        fontWeight="900"
        fontFamily="'Fredoka', sans-serif"
        style={{ textShadow: card.color === 'wild' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none' }}
      >
        {getValueDisplay()}
      </text>

      {/* Top-left corner */}
      <text
        x={s.w * 0.12}
        y={s.h * 0.16}
        textAnchor="start"
        fill="white"
        fontSize={s.cornerSize}
        fontWeight="800"
        fontFamily="'Fredoka', sans-serif"
      >
        {getValueDisplay()}
      </text>

      {/* Bottom-right corner (rotated) */}
      <text
        x={s.w * 0.88}
        y={s.h * 0.9}
        textAnchor="end"
        fill="white"
        fontSize={s.cornerSize}
        fontWeight="800"
        fontFamily="'Fredoka', sans-serif"
        transform={`rotate(180, ${s.w * 0.88}, ${s.h * 0.87})`}
      >
        {getValueDisplay()}
      </text>

      {/* Subtle card border */}
      <rect
        x="1" y="1" width={s.w - 2} height={s.h - 2}
        rx={s.w * 0.1} ry={s.w * 0.1}
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1.5"
      />

      {/* Chosen color indicator for wild cards */}
      {activeColor && card.color === 'wild' && (
        <circle
          cx={s.w / 2}
          cy={s.h * 0.82}
          r={s.w * 0.06}
          fill={colorMap[activeColor].bg}
          stroke="white"
          strokeWidth="1"
        >
          <animate attributeName="r" values={`${s.w * 0.05};${s.w * 0.07};${s.w * 0.05}`} dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
};

/** Card back design */
export const CardBack = ({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' | 'lg' }) => {
  const sizeMap = {
    xs: { w: 48, h: 72 },
    sm: { w: 56, h: 84 },
    md: { w: 72, h: 108 },
    lg: { w: 96, h: 144 },
  };
  const s = sizeMap[size];

  return (
    <svg
      width={s.w} height={s.h}
      viewBox={`0 0 ${s.w} ${s.h}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
    >
      <rect x="0" y="0" width={s.w} height={s.h} rx={s.w * 0.1} fill="#1E1B4B" />
      <rect x="3" y="3" width={s.w - 6} height={s.h - 6} rx={s.w * 0.08} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* Diamond pattern */}
      <g opacity="0.15">
        {[0, 1, 2, 3, 4].map((row) =>
          [0, 1, 2].map((col) => (
            <polygon
              key={`${row}-${col}`}
              points={`${s.w * 0.15 + col * s.w * 0.25},${s.h * 0.12 + row * s.h * 0.18 - 4} ${s.w * 0.15 + col * s.w * 0.25 + 4},${s.h * 0.12 + row * s.h * 0.18} ${s.w * 0.15 + col * s.w * 0.25},${s.h * 0.12 + row * s.h * 0.18 + 4} ${s.w * 0.15 + col * s.w * 0.25 - 4},${s.h * 0.12 + row * s.h * 0.18}`}
              fill="white"
            />
          ))
        )}
      </g>

      {/* Center emblem */}
      <ellipse
        cx={s.w / 2} cy={s.h / 2}
        rx={s.w * 0.22} ry={s.h * 0.18}
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
        transform={`rotate(-15, ${s.w / 2}, ${s.h / 2})`}
      />
    </svg>
  );
};

export default CardFace;
