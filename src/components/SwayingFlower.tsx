import React from 'react';
import { motion } from 'motion/react';

export function SwayingFlower({ className = '' }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      animate={{ rotate: [-4, 4, -4] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ transformOrigin: '32px 58px' }}
    >
      <path
        d="M32 58C32 45 30 36 32 24"
        stroke="#5C7C65"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M31 44C24 44 19 39 20 34C25 34 30 38 31 44Z"
        fill="#82A38B"
        opacity="0.85"
      />
      <path
        d="M32 38C38 37 43 32 42 28C37 28 33 32 32 38Z"
        fill="#5C7C65"
        opacity="0.85"
      />
      <ellipse cx="32" cy="14" rx="5.5" ry="8" fill="#E8A5AE" />
      <ellipse cx="41" cy="21" rx="8" ry="5.5" transform="rotate(-18 41 21)" fill="#DF7E8D" />
      <ellipse cx="23" cy="21" rx="8" ry="5.5" transform="rotate(18 23 21)" fill="#DF7E8D" />
      <ellipse cx="37.5" cy="27" rx="5.5" ry="7.5" transform="rotate(32 37.5 27)" fill="#C94B5E" />
      <ellipse cx="26.5" cy="27" rx="5.5" ry="7.5" transform="rotate(-32 26.5 27)" fill="#C94B5E" />
      <circle cx="32" cy="22" r="4.6" fill="#F4C97A" />
      <circle cx="32" cy="22" r="2.1" fill="#C23B3B" opacity="0.65" />
    </motion.svg>
  );
}

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: ((i * 4.7 + (i % 3) * 8) % 94) + 3,
  delay: (i % 6) * 0.14,
  duration: 2.6 + (i % 4) * 0.45,
  isHeart: i % 3 === 0,
  color: ['#C23B3B', '#5C7C65', '#E8A5AE', '#D97706'][i % 4],
  size: i % 3 === 0 ? 14 : 8,
}));

export function ConfettiHearts() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
    >
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -24, opacity: 0, rotate: 0, scale: 0.7 }}
          animate={{
            y: ['0%', '430%'],
            opacity: [0, 1, 1, 0],
            rotate: [0, p.id % 2 === 0 ? 200 : -200],
            scale: [0.8, 1.05, 0.9],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: 1.4,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: '0%',
          }}
        >
          {p.isHeart ? (
            <svg width={p.size} height={p.size} viewBox="0 0 24 24" fill={p.color}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <div
              style={{
                width: p.size,
                height: p.size * 0.6,
                backgroundColor: p.color,
                borderRadius: 2,
              }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}
