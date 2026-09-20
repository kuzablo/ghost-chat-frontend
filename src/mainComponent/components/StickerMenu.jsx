import { useEffect } from 'react';

/*
  [2.20.0] Универсальное меню стикеров.
  Открывается long-press на элементе. По центру экрана.
  items: [{ icon, label, onClick, danger? }]
*/
const StickerMenu = ({ open, title, subtitle, items, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sticker-menu-overlay" onClick={onClose}>
      <div className="sticker-menu" onClick={(e) => e.stopPropagation()}>
        {(title || subtitle) && (
          <div className="sticker-menu-header">
            {title && <div className="sticker-menu-title">{title}</div>}
            {subtitle && <div className="sticker-menu-subtitle">{subtitle}</div>}
          </div>
        )}
        <div className="sticker-menu-items">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              className={`sticker-menu-item ${item.danger ? 'sticker-menu-item--danger' : ''}`}
              style={{ '--sticker-delay': `${i * 0.05}s` }}
              onClick={() => {
                onClose();
                if (item.onClick) item.onClick();
              }}
            >
              <span className="sticker-menu-item-icon">{item.icon}</span>
              <span className="sticker-menu-item-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StickerMenu;