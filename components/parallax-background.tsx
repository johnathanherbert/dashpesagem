'use client';

import { useEffect, useRef, useState } from 'react';

interface ParallaxBackgroundProps {
  /** Classe extra aplicada ao container de fundo (ex: cor sólida de base). */
  className?: string;
  /** Reduz a amplitude do movimento (útil em telas menores/densas). */
  intensity?: number;
}

/**
 * Fundo decorativo com as "gemas" do design system em duas camadas que se
 * movem em velocidades diferentes conforme o mouse, criando um leve efeito
 * parallax. Fica fixo atrás do conteúdo e não captura eventos de ponteiro.
 */
export function ParallaxBackground({ className = '', intensity = 1 }: ParallaxBackgroundProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotionRef.current) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5; // -0.5..0.5
        const y = e.clientY / window.innerHeight - 0.5;
        setOffset({ x, y });
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const topX = offset.x * 28 * intensity;
  const topY = offset.y * 20 * intensity;
  const bottomX = offset.x * -36 * intensity;
  const bottomY = offset.y * -26 * intensity;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      <div className="absolute -top-[6%] -left-[8%] w-[62%] max-w-[820px] animate-[float-slow_16s_ease-in-out_infinite]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/backgrounds/gems-bg-top.svg"
          alt=""
          className="w-full opacity-25 transition-transform duration-300 ease-out will-change-transform"
          style={{
            transform: `translate3d(${topX}px, ${topY}px, 0)`,
            filter: 'drop-shadow(0 0 60px rgba(181, 222, 244, 0.2))',
          }}
        />
      </div>
      <div className="absolute -bottom-[8%] -right-[6%] w-[68%] max-w-[880px] animate-[float-slow-reverse_20s_ease-in-out_infinite]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/backgrounds/gems-bg-bottom.svg"
          alt=""
          className="w-full opacity-20 transition-transform duration-300 ease-out will-change-transform"
          style={{
            transform: `translate3d(${bottomX}px, ${bottomY}px, 0)`,
            filter: 'drop-shadow(0 0 60px rgba(95, 133, 160, 0.25))',
          }}
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(#2A4D6E_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
    </div>
  );
}
