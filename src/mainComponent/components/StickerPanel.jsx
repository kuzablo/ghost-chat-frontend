import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

/*
  [2.40.1] Свайп влево/вправо по сетке стикеров для пагинации.
           Кнопки ‹ › остались. Направление фиксируется на первых 8px.
           Если жест вертикальный — пагинация не срабатывает, скролл
           свободен.
  [2.40.0] Пагинация: 12 стикеров на страницу (4×3), стрелки ‹ ›
           и счётчик. Стикеров ≤ 12 — пагинатор скрыт.
  [2.35.16] Панель стикеров.
*/
const API_URL = 'https://api.banjoboy420.ru';
const MAX_STICKER_MB = 10;
const MAX_STICKER_BYTES = MAX_STICKER_MB * 1024 * 1024;
const PAGE_SIZE = 12;

const SWIPE_THRESHOLD = 60;
const SWIPE_MAX_DRAG = 60;
const SWIPE_DIRECTION_LOCK = 8;

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
  const [page, setPage] = useState(0);
  const fileRef = useRef(null);
  const gridRef = useRef(null);

  const totalPages = Math.max(1, Math.ceil((stickers?.length || 0) / PAGE_SIZE));

  // [2.40.0] Если page вылетел за границы — на последнюю.
  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  // [2.40.0] При смене страницы — скролл к верху.
  useEffect(() => {
    const el = gridRef.current;
    if (el) el.scrollTop = 0;
  }, [page]);

  const visibleStickers = useMemo(() => {
    if (!Array.isArray(stickers)) return [];
    const start = page * PAGE_SIZE;
    return stickers.slice(start, start + PAGE_SIZE);
  }, [stickers, page]);

  // [2.40.1] Свайп-жест. Нативный listener — иначе React onTouchMove
  // passive и preventDefault не сработает.
  useEffect(() => {
    if (!open) return;
    const el = gridRef.current;
    if (!el) return;
    if (totalPages <= 1) return;

    const state = {
      active: false,
      startX: 0,
      startY: 0,
      direction: null, // 'horizontal' | 'vertical' | null
      lastDx: 0,
    };

    const reset = () => {
      state.active = false;
      state.direction = null;
      state.lastDx = 0;
      if (el) {
        el.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = 'translate3d(0,0,0)';
        setTimeout(() => {
          if (el) el.style.transition = '';
        }, 260);
      }
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      state.active = true;
      state.startX = t.clientX;
      state.startY = t.clientY;
      state.direction = null;
      state.lastDx = 0;
      el.style.transition = 'none';
    };

    const onTouchMove = (e) => {
      if (!state.active) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - state.startX;
      const dy = t.clientY - state.startY;

      if (!state.direction) {
        if (Math.abs(dx) < SWIPE_DIRECTION_LOCK && Math.abs(dy) < SWIPE_DIRECTION_LOCK) {
          return;
        }
        state.direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      if (state.direction !== 'horizontal') return;

      // На границах — упираемся, но всё равно двигаем чуть-чуть (резина).
      const atStart = page === 0 && dx > 0;
      const atEnd = page === totalPages - 1 && dx < 0;
      let off = dx;
      if (atStart || atEnd) off = dx * 0.25;
      off = Math.max(-SWIPE_MAX_DRAG, Math.min(SWIPE_MAX_DRAG, off));

      state.lastDx = off;
      el.style.transform = `translate3d(${off}px, 0, 0)`;
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!state.active) return;
      if (state.direction !== 'horizontal') {
        reset();
        return;
      }
      const off = state.lastDx;
      if (off <= -SWIPE_THRESHOLD && page < totalPages - 1) {
        setPage((p) => Math.min(totalPages - 1, p + 1));
      } else if (off >= SWIPE_THRESHOLD && page > 0) {
        setPage((p) => Math.max(0, p - 1));
      }
      reset();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [open, page, totalPages]);

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

  const handlePrev = (e) => {
    e.stopPropagation();
    setPage((p) => Math.max(0, p - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setPage((p) => Math.min(totalPages - 1, p + 1));
  };

  const showPager = totalPages > 1;

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
          <>
            <div className="sticker-panel-grid-wrap">
              <div className="sticker-panel-grid" ref={gridRef}>
                {visibleStickers.map((s) => (
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
            </div>

            {showPager && (
              <div className="sticker-panel-pager">
                <button
                  type="button"
                  className="sticker-panel-pager-btn"
                  onClick={handlePrev}
                  disabled={page === 0}
                  aria-label="Предыдущая страница"
                >
                  ‹
                </button>
                <span className="sticker-panel-pager-counter">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  className="sticker-panel-pager-btn"
                  onClick={handleNext}
                  disabled={page === totalPages - 1}
                  aria-label="Следующая страница"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default StickerPanel;