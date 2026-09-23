import { useEffect, useState } from 'react';

/*
  [2.35.53] Радиальный пикер реакций — отдельный компонент.
  [2.35.55] Таймер сбрасывается при клике на +. Любой клик вне
            boundsRef (контейнер сообщений) моментально закрывает.
*/

const REACTIONS_MAIN = ['👍', '❤️', '🔥', '😂', '😮', '😢'];
const REACTIONS_EXTRA = ['💀', '🎉', '🥰', '🤔', '✨', '👀', '🙈', '👏', '🤝', '🍕', '☕', '💯'];

const WHEEL_R_MAIN = 56;
const WHEEL_R_EXTRA = 104;
const WHEEL_BTN = 36;
const WHEEL_PAD = 14;
const AUTOHIDE_MS = 5000;

const polar = (r, angleDeg) => {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const ReactionWheel = ({
  open,
  anchorX,
  anchorY,
  boundsRef,
  reactions = {},
  nickname,
  onPick,
  onClose,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [center, setCenter] = useState(null);
  const [timerKey, setTimerKey] = useState(0); // [2.35.56] сброс таймера

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setCenter(null);
      return;
    }
    if (typeof anchorX !== 'number' || typeof anchorY !== 'number') return;

    const bounds = boundsRef?.current?.getBoundingClientRect();
    const need = WHEEL_R_EXTRA + WHEEL_BTN / 2 + WHEEL_PAD;

    let cx = anchorX;
    let cy = anchorY;

    if (bounds) {
      const minX = bounds.left + need;
      const maxX = bounds.right - need;
      const minY = bounds.top + need;
      const maxY = bounds.bottom - need;

      cx = maxX > minX ? clamp(anchorX, minX, maxX) : (bounds.left + bounds.right) / 2;
      cy = maxY > minY ? clamp(anchorY, minY, maxY) : (bounds.top + bounds.bottom) / 2;
    }

    const dx = cx - anchorX;
    const dy = cy - anchorY;
    const shift = Math.hypot(dx, dy);
    const angle = shift > 1 ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;

    setCenter({ cx, cy, ax: anchorX, ay: anchorY, shift, angle });
    setExpanded(false);
  }, [open, anchorX, anchorY, boundsRef]);

  // [2.35.55] Таймер автоскрытия. Расширение/сворачивание + сбрасывает его.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose?.(), AUTOHIDE_MS);
    return () => clearTimeout(t);
  }, [open, expanded, timerKey, onClose]);

  // [2.35.55] Любой pointerdown вне boundsRef (и вне самого колеса) — закрыть.
  //           Внутри boundsRef — пусть MessageList/PrivateChat решает сам.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const t = e.target;
      if (!t || !t.closest) { onClose?.(); return; }
      if (t.closest('.reaction-wheel')) return;
      if (t.closest('.reaction-wheel-anchor')) return;
      const bounds = boundsRef?.current;
      if (bounds && bounds.contains(t)) return;
      onClose?.();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, boundsRef, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !center) return null;

  const { cx, cy, ax, ay, shift, angle } = center;
  const showAnchor = shift > 2;

  const renderOrbit = (emojis, radius, isExtra) => (
    <div className={`reaction-wheel-orbit ${isExtra ? 'reaction-wheel-orbit--extra' : 'reaction-wheel-orbit--main'}`}>
      {emojis.map((emoji, i) => {
        const angleDeg = (360 / emojis.length) * i;
        const pos = polar(radius, angleDeg);
        const isActive = (reactions[emoji] || []).includes(nickname);
        return (
          <button
            key={emoji}
            type="button"
            className={`reaction-wheel-btn ${isActive ? 'active' : ''}`}
            style={{
              left: pos.x - WHEEL_BTN / 2,
              top: pos.y - WHEEL_BTN / 2,
              animationDelay: `${i * 0.025}s`,
            }}
            onClick={() => onPick?.(emoji)}
            aria-label={emoji}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {showAnchor && (
        <div
          className="reaction-wheel-anchor"
          style={{
            left: cx,
            top: cy,
            '--rw-tx': `${ax - cx}px`,
            '--rw-ty': `${ay - cy}px`,
            '--rw-len': `${shift}px`,
            '--rw-angle': `${angle}deg`,
          }}
          aria-hidden="true"
        >
          <span className="reaction-wheel-anchor-line" />
          <span className="reaction-wheel-anchor-dot" />
        </div>
      )}

      <div
        className={`reaction-wheel ${expanded ? 'reaction-wheel--expanded' : ''}`}
        style={{ left: cx, top: cy }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="reaction-wheel-center">
          <button
            type="button"
            className="reaction-wheel-toggle"
            onClick={() => {
              setExpanded(v => !v);
              setTimerKey(k => k + 1);
            }}
            aria-label={expanded ? 'Свернуть' : 'Ещё эмодзи'}
          >
            {expanded ? '−' : '＋'}
          </button>
        </div>
        {renderOrbit(REACTIONS_MAIN, WHEEL_R_MAIN, false)}
        {expanded && renderOrbit(REACTIONS_EXTRA, WHEEL_R_EXTRA, true)}
      </div>
    </>
  );
};

export default ReactionWheel;