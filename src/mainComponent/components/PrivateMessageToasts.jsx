import { useEffect, useState } from 'react';
import { getAvatarColor, getInitial } from '../utils';

/*
  [2.35.30] Орбитальное уведомление о новых личных.
            Маскот в центре, аватарки непрочитанных летают вокруг по орбите.
            Без ников, без превью. Только аватарки и маскот.
            Клик → открыть диалоги. Автоскрытие 8с.
*/
const MAX_AVATARS = 5;
const AUTO_HIDE_MS = 8000;

const PrivateMessageToasts = ({ users = [], onOpenDialogs }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const key = users.map(u => u.userId).sort().join(',');

  useEffect(() => {
    if (!key) {
      setLeaving(true);
      const t = setTimeout(() => setVisible(false), 320);
      return () => clearTimeout(t);
    }
    setVisible(true);
    setLeaving(false);
    const t = setTimeout(() => setLeaving(true), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [key]);

  useEffect(() => {
    if (!leaving || !visible) return;
    const t = setTimeout(() => setVisible(false), 320);
    return () => clearTimeout(t);
  }, [leaving, visible]);

  if (!visible || users.length === 0) return null;

  const shown = users.slice(0, MAX_AVATARS);
  const n = shown.length;
  const orbitDuration = 14 + n * 2.5;
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
      <div className="pm-orbit-ring" />

      <div className="pm-orbit-mascot-wrap">
        <div className="pm-orbit-mascot" />
      </div>

      <div
        className="pm-orbit-spinner"
        style={{ animationDuration: `${orbitDuration}s` }}
      >
        {shown.map((u, i) => (
          <div
            key={u.userId}
            className="pm-orbit-slot"
            style={{ '--angle': `${(360 / n) * i}deg` }}
          >
            <div
              className="pm-orbit-entry"
              style={{ animationDelay: `${0.08 + i * 0.12}s` }}
            >
              <div
                className="pm-orbit-counter"
                style={{ animationDuration: `${orbitDuration}s` }}
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