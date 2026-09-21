import { useState, useEffect, useRef } from 'react';
import { getAvatarColor, getInitial } from '../utils';

/*
  [2.33.0] Ритуал дружбы. Огонь и вода.
           Два круга видят друг друга. Один тянется — другой отвечает.
           Согласие → слияние. Отказ → нить гаснет.
*/

const PHASE_DURATIONS = {
  appear: 500,
  pull: 700,
  accept: 550,
  merge: 900,
  reject: 650,
  done: 250,
};

const FriendshipRitual = ({
  open,
  initiatorId,
  initiatorNick,
  initiatorAvatar,
  targetId,
  targetNick,
  targetAvatar,
  myId,
  phase: incomingPhase = 'appear',
  onAccept,
  onDecline,
  onDone,
}) => {
  const [phase, setPhase] = useState(incomingPhase);
  const timersRef = useRef([]);

  const isInitiator = myId === initiatorId;
  const isTarget = myId === targetId;

  const clearTimers = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    if (!open) return;
    setPhase(incomingPhase);
    clearTimers();

    const advance = (next, delay) => {
      const t = setTimeout(() => setPhase(next), delay);
      timersRef.current.push(t);
    };

    if (incomingPhase === 'appear') {
      advance('wait', PHASE_DURATIONS.appear);
    } else if (incomingPhase === 'pull') {
      advance('wait', PHASE_DURATIONS.pull);
    } else if (incomingPhase === 'accept') {
      advance('merge', PHASE_DURATIONS.accept);
    } else if (incomingPhase === 'merge') {
      advance('done', PHASE_DURATIONS.merge);
    } else if (incomingPhase === 'reject') {
      advance('done', PHASE_DURATIONS.reject);
    }

    return clearTimers;
  }, [open, incomingPhase]);

  useEffect(() => {
    if (!open) return;
    if (phase !== 'done') return;
    const t = setTimeout(() => onDone && onDone(), PHASE_DURATIONS.done);
    return () => clearTimeout(t);
  }, [phase, open, onDone]);

  if (!open) return null;

  const showButtons = phase === 'wait' && isTarget;
  const showSkip = phase === 'wait';
  const skipLabel = isInitiator ? 'Свернуть' : 'Позже';

  const renderOrbContent = (nick, avatar) => (
    <div
      className="fr-orb-inner"
      style={avatar
        ? {
            backgroundImage: `url(${avatar})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : { background: getAvatarColor(nick) }
      }
    >
      {!avatar && getInitial(nick)}
    </div>
  );

  return (
    <div className={`fr-overlay fr-overlay--${phase}`} role="dialog" aria-modal="true">
      <div className="fr-stage">

        {/* Левый круг — всегда инициатор (огонь) */}
        <div className={`fr-orb fr-orb--fire fr-orb--${phase}`}>
          <div className="fr-orb-halo" />
          {renderOrbContent(initiatorNick, initiatorAvatar)}
          <div className="fr-orb-nick">{initiatorNick}</div>
        </div>

        {/* Нить между ними — SVG */}
        <svg
          className={`fr-thread fr-thread--${phase}`}
          viewBox="0 0 320 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="fr-thread-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FF7A45" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#3BB5E8" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path
            className="fr-thread-path"
            d="M 20 60 C 100 15, 220 105, 300 60"
            fill="none"
            stroke="url(#fr-thread-grad)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        {/* Правый круг — всегда получатель (вода) */}
        <div className={`fr-orb fr-orb--water fr-orb--${phase}`}>
          <div className="fr-orb-halo" />
          {renderOrbContent(targetNick, targetAvatar)}
          <div className="fr-orb-nick">{targetNick}</div>
        </div>

        {phase === 'merge' && <div className="fr-flash" />}
      </div>

      <div className="fr-caption">
        {phase === 'pull' && isInitiator && 'Нить тянется…'}
        {phase === 'appear' && isTarget && `${initiatorNick} тянется к тебе`}
        {phase === 'wait' && isInitiator && `Ждём ответа ${targetNick}`}
        {phase === 'wait' && isTarget && `${initiatorNick} предлагает дружбу`}
        {phase === 'accept' && 'Согласие…'}
        {phase === 'merge' && 'Теперь вы — одно'}
        {phase === 'reject' && 'Нить растворилась'}
      </div>

      {showButtons && (
        <div className="fr-actions">
          <button
            type="button"
            className="fr-btn fr-btn--accept"
            onClick={onAccept}
          >
            Принять
          </button>
          <button
            type="button"
            className="fr-btn fr-btn--decline"
            onClick={onDecline}
          >
            Отклонить
          </button>
        </div>
      )}

      {showSkip && (
        <button
          type="button"
          className="fr-skip"
          onClick={onDone}
          aria-label={skipLabel}
          title={skipLabel}
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default FriendshipRitual;