import { useState, useRef } from 'react';

/*
  [2.35.16] Панель стикеров. Сетка 4×N, 90px ячейка.
            Админ видит кнопку ＋ для загрузки gif.
*/
const API_URL = 'https://api.banjoboy420.ru';
const MAX_STICKER_MB = 10;
const MAX_STICKER_BYTES = MAX_STICKER_MB * 1024 * 1024;

const StickerPanel = ({
  open,
  onClose,
  stickers,
  onPick,
  isAdmin,
  token,
  onUploaded,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  if (!open) return null;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type !== 'image/gif') {
      setError('Только GIF');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (file.size > MAX_STICKER_BYTES) {
      setError(`Файл больше ${MAX_STICKER_MB} МБ`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('token', token);
      const res = await fetch(`${API_URL}/api/upload-sticker`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      if (onUploaded) onUploaded(data.stickers || []);
    } catch (err) {
      setError('Не удалось: ' + (err?.message || ''));
      setTimeout(() => setError(''), 4000);
    } finally {
      setUploading(false);
    }
  };

  const handlePick = (url) => {
    if (onPick) onPick(url);
  };

  return (
    <>
      <div className="sticker-panel-overlay" onClick={onClose} />
      <div className="sticker-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sticker-panel-header">
          <span className="sticker-panel-title">Стикеры</span>

          {isAdmin && (
            <button
              type="button"
              className="sticker-panel-upload"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title={`Загрузить GIF (до ${MAX_STICKER_MB} МБ)`}
            >
              {uploading ? '⏳' : '＋'}
            </button>
          )}

          <button
            type="button"
            className="sticker-panel-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>

          {isAdmin && (
            <input
              ref={fileRef}
              type="file"
              accept="image/gif"
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
          )}
        </div>

        {error && <div className="sticker-panel-error">{error}</div>}

        {stickers.length === 0 ? (
          <div className="sticker-panel-empty">
            {isAdmin
              ? 'Ты пока не загрузил ни одной гифки. Жми ＋'
              : 'Тишина. Скоро здесь что-то появится.'}
          </div>
        ) : (
          <div className="sticker-panel-grid">
            {stickers.map((s) => (
              <button
                key={s.id}
                type="button"
                className="sticker-panel-tile"
                onClick={() => handlePick(s.url)}
                title="Отправить"
              >
                <img src={s.url} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default StickerPanel;