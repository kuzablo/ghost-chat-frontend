import { useEffect, useRef, useState } from 'react';
import { getAvatarColor, getInitial } from '../utils';

/*
  [2.35.32] Орбита v3 — каждая аватарка летает как спутник.
            У каждой своя орбита: радиус, наклон, скорость, направление.
            Уходит за маскота → выходит спереди. z-index и scale честные.
            Без ников, без превью. Клик → открыть диалоги. Автоскрытие 8с.
*/
const MAX_AVATARS = 5;
const AUTO_HIDE_MS = 8000;

// Орбиты: rx/ry — радиусы эллипса, speed — рад/с (минус = против часовой),
// tilt — наклон орбиты в градусах, phase — стартовый угол в радианах.
// Разные — чтобы движение было живым, как настоящие спутники.
const ORBITS = [
  { rx: 96,  ry: 42, speed: 0.72,  tilt: -10, phase: 0.15 },
  { rx: 114, ry: 52, speed: -0.52, tilt: 14,  phase: 2.10 },
  { rx: 84,  ry: 36, speed: 0.90,  tilt: -4,  phase: 4.20 },
  { rx: 108, ry: 48, speed: -0.64, tilt: 8,   phase: 1.00 },
  { rx: 100, ry: 44, speed: 0.78,  tilt: -14, phase: 3.30 },
];

const PrivateMessageToasts = ({ users = [], onOpenDialogs }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const orbitRef = useRef(null);
  const rafRef = useRef(null);

  const key = users.map(u => u.userId).sort().join(',');

  // Появление / автоскрытие
  useEffect(() => {
    if (!key) {
      setLeaving(true);
      const t = setTimeout(() => setVisible(false), 340);
      return () => clearTimeout(t);
    }
    setVisible(true);
    setLeaving(false);
    const t = setTimeout(() => setLeaving(true), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [key]);

  useEffect(() => {
    if (!leaving || !visible) return;
    const t = setTimeout(() => setVisible(false), 340);
    return () => clearTimeout(t);
  }, [leaving, visible]);

  // Анимация спутников
  useEffect(() => {
    if (!visible) return;
    const stage = orbitRef.current;
    if (!stage) return;

    const start = performance.now();

    const tick = (time) => {
      const t = (time - start) / 1000;
      const nodes = stage.querySelectorAll('.pm-orbit-slot');
      const n = nodes.length;

      for (let i = 0; i < n; i++) {
        const o = ORBITS[i % ORBITS.length];
        const a = o.phase + o.speed * t;

        // Позиция в локальной системе орбиты
        const rawX = Math.cos(a) * o.rx;
        const rawY = Math.sin(a) * o.ry;

        // Наклон орбиты
        const rad = (o.tilt * Math.PI) / 180;
        const x = rawX * Math.cos(rad) - rawY * Math.sin(rad);
        const y = rawX * Math.sin(rad) + rawY * Math.cos(rad);

        // Глубина: sin(a) → -1 сзади, +1 спереди
        const depth = (Math.sin(a) + 1) / 2;
        const scale = 0.6 + depth * 0.5;
        const opacity = 0.42 + depth * 0.58;
        const z = Math.round(depth * 100);

        const el = nodes[i];
        el.style.transform =
          `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.zIndex = String(z);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  if (!visible || users.length === 0) return null;

  const shown = users.slice(0, MAX_AVATARS);
  const more = users.length - MAX_AVATARS;

  const handleClick = () => {
    setLeaving(true);
    onOpenDialogs();
  };

  return (
    <div
      className={`pm-orbit${leaving ? ' pm-orbit--out' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Новые личные сообщения"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="pm-orbit-halo pm-orbit-halo--outer" />
      <div className="pm-orbit-halo pm-orbit-halo--inner" />

      <div className="pm-orbit-mascot-wrap">
        <div className="pm-orbit-mascot" />
      </div>

      <div className="pm-orbit-stage" ref={orbitRef}>
        {shown.map((u, i) => (
          <div
            key={u.userId}
            className="pm-orbit-slot"
            style={{ animationDelay: `${0.06 + i * 0.12}s` }}
          >
            <div
              className="pm-orbit-avatar"
              style={u.avatarUrl
                ? { backgroundImage: `url(${u.avatarUrl})` }
                : { background: getAvatarColor(u.nickname || '?') }
              }
            >
              {!u.avatarUrl && getInitial(u.nickname || '?')}
            </div>
          </div>
        ))}
      </div>

      {more > 0 && (
        <div className="pm-orbit-more">+{more}</div>
      )}
    </div>
  );
};

export default PrivateMessageToasts;