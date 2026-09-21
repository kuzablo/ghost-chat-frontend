import { forwardRef, useRef, useEffect } from 'react';
import { getAvatarColor, getInitial, formatMessageDate } from '../utils';

/*
  [2.32.37] Свайп вправо через DOM — без setState на каждом кадре.
  [2.30.0] Свайп вправо — закрытие. Кнопка «←» вместо крестика.
           Секции по датам: Сегодня / Вчера / Раньше.
  [2.17.0] Панель диалогов.
*/
const DialogsPanel = forwardRef(({
  dialogs,
  players,
  myId,
  onOpen,
  onClose,
}, ref) => {
  const isOnline = (userId) => players.some(p => p.userId === userId);

  const panelRef = useRef(null);
  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    direction: null,
    lastDx: 0,
  });

  // связываем внешний ref с внутренним
  useEffect(() => {
    if (typeof ref === 'function') ref(panelRef.current);
    else if (ref) ref.current = panelRef.current;
  }, [ref]);

  const isSameDay = (a, b) => {
    if (!a || !b) return false;
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  };

  const getSectionKey = (timestamp) => {
    if (!timestamp) return 'old';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const d = new Date(timestamp);
    if (d >= today) return 'today';
    if (d >= yesterday) return 'yesterday';
    return 'old';
  };

  const sectionLabel = {
    today: 'Сегодня',
    yesterday: 'Вчера',
    old: 'Раньше',
  };

  const visibleDialogs = dialogs.filter(d => d.userId !== myId);

  const sections = [];
  let currentKey = null;
  visibleDialogs.forEach(d => {
    const key = getSectionKey(d.lastAt);
    if (key !== currentKey) {
      sections.push({ key, label: sectionLabel[key], items: [] });
      currentKey = key;
    }
    sections[sections.length - 1].items.push(d);
  });

  /* ===== Свайп вправо — через DOM, без setState ===== */

  const SWIPE_THRESHOLD = 80;
  const SWIPE_MAX = 200;
  const DIRECTION_LOCK = 8;

  const resetPanel = (animated = true) => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transition = animated
      ? 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)'
      : 'none';
    el.style.transform = '';
    if (animated) {
      setTimeout(() => {
        if (panelRef.current) panelRef.current.style.transition = '';
      }, 240);
    }
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const s = swipeRef.current;
    s.active = true;
    s.startX = t.clientX;
    s.startY = t.clientY;
    s.direction = null;
    s.lastDx = 0;
    if (panelRef.current) {
      panelRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e) => {
    const s = swipeRef.current;
    if (!s.active) return;
    if (e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - s.startX;
    const dy = t.clientY - s.startY;

    if (!s.direction) {
      if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
      s.direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    if (s.direction === 'vertical') return;

    if (dx > 0) {
      const off = Math.min(dx, SWIPE_MAX);
      s.lastDx = off;
      if (panelRef.current) {
        panelRef.current.style.transform = `translateX(${off}px)`;
      }
      if (e.cancelable) e.preventDefault();
    }
  };

  const handleTouchEnd = (e) => {
    const s = swipeRef.current;
    if (!s.active) return;
    s.active = false;

    if (s.direction === 'horizontal' && s.lastDx > SWIPE_THRESHOLD) {
      onClose();
      return;
    }
    resetPanel(true);
    s.direction = null;
    s.lastDx = 0;
  };

  return (
    <>
      <div
        className="dialogs-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="dialogs-panel"
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <header className="dialogs-header">
          <button
            type="button"
            className="dialogs-back"
            onClick={onClose}
            aria-label="Назад"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h4 className="dialogs-title">Диалоги</h4>
          <span className="dialogs-header-spacer" aria-hidden="true" />
        </header>

        <div className="dialogs-list">
          {visibleDialogs.length === 0 && (
            <div className="dialogs-empty">
              <div className="dialogs-empty-icon">💬</div>
              <div className="dialogs-empty-title">Пока пусто</div>
              <div className="dialogs-empty-text">
                Открой панель игроков <b>👥</b> и нажми <b>✉️</b> — начни первый диалог.
              </div>
            </div>
          )}

          {sections.map(section => (
            <div key={section.key} className="dialogs-section">
              <div className="dialogs-section-label">{section.label}</div>
              {section.items.map(d => {
                const online = isOnline(d.userId);
                const hasUnread = d.unread > 0;
                return (
                  <button
                    key={d.userId}
                    type="button"
                    className={`dialog-item ${hasUnread ? 'dialog-item--unread' : ''}`}
                    onClick={() => onOpen(d.userId, d.nickname)}
                  >
                    <div
                      className="dialog-avatar"
                      style={{ background: getAvatarColor(d.nickname) }}
                    >
                      {getInitial(d.nickname)}
                      {online && <span className="dialog-online" />}
                    </div>

                    <div className="dialog-body">
                      <div className="dialog-top">
                        <span className="dialog-nick">{d.nickname}</span>
                        <span className="dialog-time">
                          {formatMessageDate(d.lastAt)}
                        </span>
                      </div>
                      <div className="dialog-bottom">
                        <span className="dialog-last">
                          {d.lastText || '—'}
                        </span>
                        {hasUnread && (
                          <span className="dialog-badge">
                            {d.unread > 99 ? '99+' : d.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
});

DialogsPanel.displayName = 'DialogsPanel';

export default DialogsPanel;