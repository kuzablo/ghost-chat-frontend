import React from 'react';

const LatestVersionLink = ({ url = window.location.href }) => {
  const handleClick = (e) => {
    e.preventDefault();
    // Добавляем параметр версии, чтобы сбросить кэш
    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    params.set('v', Date.now()); // или фиксированная версия
    window.location.href = base + '?' + params.toString();
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'linear-gradient(135deg, #ff8fa3 0%, #ff6b8a 100%)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '20px',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '14px',
        boxShadow: '0 4px 12px rgba(255, 143, 163, 0.3)',
      }}
    >
      Скорее жми сюда
    </a>
  );
};

export default LatestVersionLink;