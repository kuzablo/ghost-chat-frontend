import { useEffect, useRef } from 'react';
import { getAvatarColor, getInitial } from '../utils';
import Avatar from './Avatar';

/*
  [2.39.4] mascotRef — ref на обёртку маскота. Через него маскот из шапки
           летит точно на место, а не в приблизительный центр контейнера.
           mascotOnly — рендерить только маскота, без орбиты и аватарок.
           Нужно, чтобы маскот был в DOM даже когда непрочитанных нет —
           ref валиден для будущих полётов.
  [2.35.40] Клик по pointerdown.
  [2.35.34] Кнопка вместо div.
*/
const MAX_AVATARS = 5;
const MOVE_CANCEL_PX = 12;

const ORBITS = [
  { rx: 96,  ry: 42, speed: 0.72,  tilt: -10, phase: 0.15 },
  { rx: 114, ry: 52, speed: -0.52, tilt: 14,  phase: 2.10 },
  { rx: 84,  ry: 36, speed: 0.90,  tilt: -4,  phase: 4.20 },
  { rx: 108, ry: 48, speed: -0.64, tilt: 8,   phase: 1.00 },
  { rx: 100, ry: 44, speed: 0.78,  tilt: -14, phase: 3.30 },
];

const prevent = (e) => e.preventDefault();

const OrbitNotification = ({
  users = [],
  onClick,
  className = '',
  mascotRef = null,
  mascotOnly = false,
}) => {
  const orbitRef = useRef(null);
  const rafRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0, fired: false });

  useEffect(() => {
    if (mascotOnly) return;
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
  }, [mascotOnly]);

  const shown = mascotOnly ? [] : users.slice(0, MAX_AVATARS);
  const more = mascotOnly ? 0 : Math.max(0, users.length - MAX_AVATARS);
  const hasOrbit = shown.length > 0;

  const handlePointerDown = (e) => {
    if (!onClick) return;
    e.stopPropagation();
    e.preventDefault();
    startPosRef.current = { x: e.clientX, y: e.clientY, fired: true };
    onClick();
  };

  const handlePointerMove = (e) => {
    if (!startPosRef.current.fired) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
      startPosRef.current.fired = false;
    }
  };

  const handlePointerUp = () => {
    startPosRef.current.fired = false;
  };

  const classes = [
    'pm-orbit',
    className,
    mascotOnly || !hasOrbit ? 'pm-orbit--mascot-only' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={prevent}
      onDragStart={prevent}
      aria-label="Новые личные сообщения"
    >
      {hasOrbit && (
        <>
          <span className="pm-orbit-halo pm-orbit-halo--outer" aria-hidden="true" />
          <span className="pm-orbit-halo pm-orbit-halo--inner" aria-hidden="true" />
        </>
      )}

      <span
        ref={mascotRef}
        className="pm-orbit-mascot-wrap"
        aria-hidden="true"
      >
        <span className="pm-orbit-mascot" />
      </span>

      {hasOrbit && (
        <span className="pm-orbit-stage" ref={orbitRef} aria-hidden="true">
          {shown.map((u, i) => (
            <span
              key={u.userId}
              className="pm-orbit-slot"
              style={{ animationDelay: `${0.06 + i * 0.12}s` }}
            >
              <Avatar
                src={u.avatarUrl}
                nickname={u.nickname || '?'}
                className="pm-orbit-avatar"
                alt=""
              />
            </span>
          ))}
        </span>
      )}

      {more > 0 && (
        <span className="pm-orbit-more">+{more}</span>
      )}
    </button>
  );
};

export default OrbitNotification;