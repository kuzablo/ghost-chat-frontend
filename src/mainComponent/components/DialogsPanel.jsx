import { forwardRef } from 'react';
import { getAvatarColor, getInitial, formatMessageDate } from '../utils';

/*
  [2.17.0] Панель диалогов.
  Открывается по кнопке 💬 или из PlayersPanel.
  Показывает переписки, сортирует по времени последнего (с сервера).
*/
const DialogsPanel = forwardRef(({
  dialogs,
  players,
  myId,
  onOpen,
  onClose,
}, ref) => {
  const isOnline = (userId) => players.some(p => p.userId === userId);

  return (
    <>
      <div className="dialogs-overlay" onClick={onClose} />
      <aside className="dialogs-panel" ref={ref}>
        <header className="dialogs-header">
          <h4>Диалоги</h4>
          <button
            className="dialogs-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="dialogs-list">
          {dialogs.length === 0 && (
            <div className="dialogs-empty">
              Пока ни с кем не общался. Открой панель игроков 👥 и нажми ✉️.
            </div>
          )}

          {dialogs.map(d => {
            const online = isOnline(d.userId);
            const isMine = d.userId === myId;
            if (isMine) return null;

            return (
              <button
                key={d.userId}
                type="button"
                className={`dialog-item ${d.unread > 0 ? 'dialog-item--unread' : ''}`}
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
                    {d.unread > 0 && (
                      <span className="dialog-badge">{d.unread}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
});

DialogsPanel.displayName = 'DialogsPanel';

export default DialogsPanel;