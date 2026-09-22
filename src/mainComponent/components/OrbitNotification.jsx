import { useEffect, useRef } from 'react';
import { getAvatarColor, getInitial } from '../utils';

/*
  [2.35.34] Орбита-уведомление — переписано на <button> для надёжного клика.
            У каждой аватарки своя орбита: радиус, наклон, скорость, направление.
            Аватарка уходит за маскота и выходит спереди.
*/
const MAX_AVATARS = 5;

const ORBITS = [
  { rx: 96,  ry: 42, speed: 0.72,  tilt: -10, phase: 0.15 },
  { rx: 114, ry: 52, speed: -0.52, tilt: 14,  phase: 2.10 },
  { rx: 84,  ry: 36, speed: 0.90,  tilt: -4,  phase: 4.20 },
  { rx: 108, ry: 48, speed: -0.64, tilt: 8,   phase: 1.00 },
  { rx: 100, ry: 44, speed: 0.78,  tilt: -14, phase: 3.30 },
];

const OrbitNotification = ({
  users = [],
  onClick,
  className = '',
}) => {
  const orbitRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
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

        const rawX = Math.cos(a) * o.rx;
        const rawY = Math.sin(a) * o.ry;

        const rad = (o.tilt * Math.PI) / 180;
        const x = rawX * Math.cos(rad) - rawY * Math.sin(rad);
        const y = rawX * Math.sin(rad) + rawY * Math.cos(rad);

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
  }, []);

  if (users.length === 0) return null;

  const shown = users.slice(0, MAX_AVATARS);
  const more = users.length - MAX_AVATARS;

  return (
    <button
      type="button"
      className={`pm-orbit ${className}`.trim()}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
      aria-label="Новые личные сообщения"
    >
      <span className="pm-orbit-halo pm-orbit-halo--outer" aria-hidden="true" />
      <span className="pm-orbit-halo pm-orbit-halo--inner" aria-hidden="true" />

      <span className="pm-orbit-mascot-wrap" aria-hidden="true">
        <span className="pm-orbit-mascot" />
      </span>

      <span className="pm-orbit-stage" ref={orbitRef} aria-hidden="true">
        {shown.map((u, i) => (
          <span
            key={u.userId}
            className="pm-orbit-slot"
            style={{ animationDelay: `${0.06 + i * 0.12}s` }}
          >
            <span
              className="pm-orbit-avatar"
              style={u.avatarUrl
                ? { backgroundImage: `url(${u.avatarUrl})` }
                : { background: getAvatarColor(u.nickname || '?') }
              }
            >
              {!u.avatarUrl && getInitial(u.nickname || '?')}
            </span>
          </span>
        ))}
      </span>

      {more > 0 && (
        <span className="pm-orbit-more">+{more}</span>
      )}
    </button>
  );
};

export default OrbitNotification;