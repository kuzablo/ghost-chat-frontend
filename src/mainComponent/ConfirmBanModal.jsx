import React from 'react';

const ConfirmBanModal = ({ open, nickname, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          zIndex: 998,
        }}
        onClick={onCancel}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,255,255,0.9)',
          borderRadius: '16px',
          padding: '20px',
          zIndex: 1000,
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '90vw',
        }}
      >
        <h4 style={{ marginTop: 0, color: '#2c3e50', fontSize: '16px', marginBottom: '12px' }}>
          Забанить пользователя {nickname} навсегда?
        </h4>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            style={{
              background: 'linear-gradient(135deg, #ff8fa3 0%, #ff6b8a 100%)',
              border: 'none',
              color: 'white',
              padding: '10px 18px',
              borderRadius: '14px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
            onClick={onConfirm}
          >
            Да, забанить
          </button>
          <button
            style={{
              background: '#e0e6ed',
              border: 'none',
              color: '#2c3e50',
              padding: '10px 18px',
              borderRadius: '14px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
            onClick={onCancel}
          >
            Отмена
          </button>
        </div>
      </div>
    </>
  );
};

export default ConfirmBanModal;