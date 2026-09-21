import { useEffect, useRef } from 'react';

/*
  [2.33.8] Пульс комнаты — тонкая полоска-дыхание под шапкой.
           Не метрика, не индикатор. Просто присутствие.
*/
const RoomPulse = ({ playersCount = 0, typingCount = 0, isConnected = false }) => {
  const svgRef = useRef(null);
  const pathRef = useRef(null);

  const stateRef = useRef({
    // текущее (плавно интерполируется к целевому)
    amp: 0.5,
    freq: 1,
    speed: 0.008,
    // целевые
    targetAmp: 0.5,
    targetFreq: 1,
    targetSpeed: 0.008,
    phase: 0,
    raf: null,
    running: false,
    width: 0,
    height: 8,
  });

  // Считаем цели при изменении входных данных
  useEffect(() => {
    const s = stateRef.current;

    const baseAmp = 0.6;
    const baseFreq = 1.0;
    const baseSpeed = 0.008;

    if (!isConnected) {
      s.targetAmp = 0.3;
      s.targetFreq = 0.6;
      s.targetSpeed = 0.004;
    } else {
      s.targetAmp = baseAmp + Math.min(playersCount, 8) * 0.25;
      s.targetFreq = baseFreq + Math.min(typingCount, 4) * 0.6;
      s.targetSpeed = baseSpeed + Math.min(typingCount, 4) * 0.006;
    }

    // Запускаем цикл, если стоит
    if (!s.running) {
      s.running = true;
      tick();
    }

    return () => {};
  }, [playersCount, typingCount, isConnected]);

  // Измерение ширины
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const update = () => {
      const rect = svg.getBoundingClientRect();
      stateRef.current.width = rect.width;
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Основной цикл
  const tick = () => {
    const s = stateRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;

    if (!svg || !path) {
      s.running = false;
      return;
    }

    // Не жжём CPU во вкладке в фоне
    if (document.hidden) {
      s.raf = requestAnimationFrame(tick);
      return;
    }

    // Плавная интерполяция (lerp)
    s.amp += (s.targetAmp - s.amp) * 0.04;
    s.freq += (s.targetFreq - s.freq) * 0.04;
    s.speed += (s.targetSpeed - s.speed) * 0.04;

    s.phase += s.speed;

    const width = s.width;
    const height = s.height;
    if (width <= 0) {
      s.raf = requestAnimationFrame(tick);
      return;
    }

    const midY = height / 2;
    const step = 4; // точек по X
    const pointsCount = Math.ceil(width / step);

    let d = '';
    for (let i = 0; i <= pointsCount; i++) {
      const x = i * step;
      const t = x / width;

      // Фундаментальная волна + мягкая подсветка фаз
      const y =
        midY +
        Math.sin(t * Math.PI * 2 * s.freq + s.phase) * s.amp +
        Math.sin(t * Math.PI * 4 * s.freq + s.phase * 1.3) * (s.amp * 0.25);

      if (i === 0) d += `M ${x.toFixed(1)} ${y.toFixed(2)}`;
      else d += ` L ${x.toFixed(1)} ${y.toFixed(2)}`;
    }

    path.setAttribute('d', d);

    s.raf = requestAnimationFrame(tick);
  };

  // Остановка
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      s.running = false;
      if (s.raf) cancelAnimationFrame(s.raf);
    };
  }, []);

  return (
    <div className="room-pulse" aria-hidden="true">
      <svg
        ref={svgRef}
        className="room-pulse-svg"
        preserveAspectRatio="none"
        viewBox="0 0 100 8"
        width="100%"
        height="8"
      >
        <defs>
          <linearGradient id="room-pulse-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--btn-bg)" stopOpacity="0" />
            <stop offset="20%" stopColor="var(--btn-bg)" stopOpacity="0.7" />
            <stop offset="50%" stopColor="var(--nick-color)" stopOpacity="0.9" />
            <stop offset="80%" stopColor="var(--btn-bg)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--btn-bg)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          ref={pathRef}
          d=""
          fill="none"
          stroke="url(#room-pulse-grad)"
          strokeWidth="1.4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};

export default RoomPulse;