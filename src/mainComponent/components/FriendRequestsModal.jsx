import React from 'react';

const FriendRequestsModal = ({ requests, onAccept, onDecline, onClose }) => {
  if (!requests.length) return null;

  return (
    <>
      <div className="blur-overlay" onClick={onClose} />
      <div className="friend-requests-modal">
        <div className="friend-requests-header">
          <h4>Запросы в друзья</h4>
          <button className="friend-requests-close" onClick={onClose}>×</button>
        </div>
        <div className="friend-requests-list">
          {requests.map(req => (
            <div key={req.requestId} className="friend-request-item">
              <span>{req.senderNickname} хочет добавить вас в друзья</span>
              <div className="friend-request-actions">
                <button className="btn" onClick={() => onAccept(req.requestId)}>Принять</button>
                <button className="btn" onClick={() => onDecline(req.requestId)}>Отклонить</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default FriendRequestsModal;