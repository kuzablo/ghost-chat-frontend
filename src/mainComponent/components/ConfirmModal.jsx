import React from 'react';

const ConfirmModal = ({ open, title, description, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <>
      <div className="blur-overlay" onClick={onCancel} />
      <div className="confirm-modal">
        <div className="confirm-modal-content">
          <h3>{title || 'Подтверждение'}</h3>
          <p>{description || 'Вы уверены?'}</p>
          <div className="confirm-modal-actions">
            <button className="btn confirm-btn" onClick={onConfirm}>Да</button>
            <button className="btn cancel-btn" onClick={onCancel}>Отмена</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmModal;