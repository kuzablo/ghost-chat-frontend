import { useEffect } from 'react';
import '../../styles/Chat.storage.css';

/*
  [2.47.0] Панель хранилища. Пока — минимальная: список карточек.
  Красота (сетка, dragndrop, тосты) — следующими шагами.
*/

const TYPE_LABEL = {
  text: '📝 Текст',
  image: '📷 Фото',
  sticker: '🎨 Гифка',
  voice: '🎤 Голос',
  video: '📹 Видео',
};

const StoragePanel = ({ open, onClose, items, isLoaded, error, onDelete }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="storage-overlay" onClick={onClose} />
      <aside className="storage-panel">
        <header className="storage-header">
          <div className="storage-brand">
            <div className="storage-brand-mascot" aria-hidden="true" />
            <div className="storage-brand-text">
              <h2 className="storage-title">Хранилище</h2>
              <div className="storage-sub">
                {items.length} {items.length === 1 ? 'запись' : 'записей'}
              </div>
            </div>
          </div>
          <button className="storage-close" onClick={onClose} aria-label="Закрыть">✕</button>
        </header>

        {error && <div className="storage-error">{error}</div>}

        <div className="storage-body">
          {!isLoaded ? (
            <div className="storage-loading">
              <div className="storage-loading-mascot" />
            </div>
          ) : items.length === 0 ? (
            <div className="storage-empty">
              <div className="storage-empty-mascot" />
              <div className="storage-empty-title">Пока пусто</div>
              <div className="storage-empty-text">
                Сохраняй лучшее из чата — долгое нажатие на сообщение.
              </div>
            </div>
          ) : (
            <ul className="storage-list">
              {items.map(it => (
                <li key={it.id} className="storage-item">
                  <div className="storage-item-head">
                    <span className="storage-item-type">{TYPE_LABEL[it.type] || it.type}</span>
                    {it.source?.nickname && (
                      <span className="storage-item-from">{it.source.nickname}</span>
                    )}
                  </div>
                  <div className="storage-item-preview">
                    {it.type === 'text' && (it.payload.text || '').slice(0, 200)}
                    {it.type === 'image' && <img src={it.payload.imageUrl} alt="" />}
                    {it.type === 'sticker' && <img src={it.payload.stickerUrl} alt="" />}
                    {it.type === 'voice' && <span>🎤 {Math.round(it.payload.voiceDuration || 0)}с</span>}
                    {it.type === 'video' && <span>📹 {Math.round(it.payload.videoDuration || 0)}с</span>}
                  </div>
                  <button
                    type="button"
                    className="storage-item-del"
                    onClick={() => onDelete(it.id)}
                    title="Удалить из хранилища"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
};

export default StoragePanel;