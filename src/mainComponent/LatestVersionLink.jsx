import React from 'react';

const LatestVersionLink = () => {
  const NEW_VERSION_URL = 'https://banjoboy420.ru/';

  return (
    <a
      href={NEW_VERSION_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: '#3BB5E8',
        color: '#FFFFFF',
        padding: '10px 22px',
        borderRadius: '24px',
        textDecoration: 'none',
        fontWeight: 700,
        fontSize: '14px',
        border: '3px solid #111111',
        boxShadow: '0 4px 0 rgba(0, 0, 0, 0.18)',
      }}
    >
      Скорее жми сюда
    </a>
  );
};

export default LatestVersionLink;