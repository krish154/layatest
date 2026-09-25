import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface VoiceWaveformProps {
  isActive: boolean;
  volume?: number;
  className?: string;
}

export default function VoiceWaveform({ isActive, volume = 0.5, className = '' }: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const bars = 24;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / bars - 2;
      const centerY = height / 2;

      for (let i = 0; i < bars; i++) {
        const x = i * (barWidth + 2);
        
        let barHeight: number;
        if (isActive) {
          // Animated bars
          const time = Date.now() / 200;
          const wave = Math.sin(time + i * 0.5) * 0.5 + 0.5;
          barHeight = (wave * volume * height * 0.8) + 4;
        } else {
          barHeight = 4;
        }

        // Gradient color
        const gradient = ctx.createLinearGradient(x, centerY - barHeight / 2, x, centerY + barHeight / 2);
        gradient.addColorStop(0, isActive ? 'rgba(139, 92, 246, 0.8)' : 'rgba(75, 85, 99, 0.3)');
        gradient.addColorStop(1, isActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(55, 65, 81, 0.2)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, volume]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={240}
        height={40}
        className="w-full h-10"
      />
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-lg border border-violet-500/20"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </div>
  );
}
