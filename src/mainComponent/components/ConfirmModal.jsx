import React from 'react';

/*
  [2.32.40] Универсальный модал. Пропсы:
            danger      — красная кнопка подтверждения
            confirmText — текст кнопки подтверждения (по умолчанию «Да»)
            cancelText  — текст кнопки отмены (по умолчанию «Отмена»)
            Заменил ConfirmBanModal — тот был с инлайн-стилями,
            не подхватывал тёмную тему.
*/
const ConfirmModal = ({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Да',
  cancelText = 'Отмена',
  danger = false,
}) => {
  if (!open) return null;

  return (
    <>
      <div className="blur-overlay" onClick={onCancel} />
      <div className="confirm-modal">
        <div className="confirm-modal-content">
          <h3>{title || 'Подтверждение'}</h3>
          <p>{description || 'Вы уверены?'}</p>
          <div className="confirm-modal-actions">
            <button
              className={`btn confirm-btn${danger ? ' confirm-btn--danger' : ''}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
            <button className="btn cancel-btn" onClick={onCancel}>
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmModal;