import { forwardRef } from 'react';

const PlayersPanel = forwardRef(({
  players,
  friends,
  friendRequests,
  myId,
  searchQuery,
  setSearchQuery,
  unreadByUser,
  isAdmin,
  onWatchChat,
  onBanConfirm,
  onRequestDuel,
  onOpenPrivateChat,
  onFriendRequest,
  onAcceptRequest,
  onDeclineRequest,
}, ref) => {
  const isFriendOnline = (friendId) => players.some(p => p.userId === friendId);

  const filteredPlayers = players.filter(p =>
    p.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const friendIds = new Set(friends.map(f => f.userId));
  const nonFriends = filteredPlayers.filter(p => !friendIds.has(p.userId) && p.userId !== myId);
  const filteredFriends = friends.filter(f =>
    f.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const myself = filteredPlayers.find(p => p.userId === myId);

  return (
    <div className="players-overlay" ref={ref}>
      <h4>Онлайн</h4>
      <input
        className="search-input"
        type="text"
        placeholder="Поиск"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="players-list">
        {/* Секция: Вы */}
        {myself && (
          <>
            <div className="friends-header">Вы</div>
            <div className="player-item" key={myself.id}>
              <span>
                {myself.nickname}
                <small>(W:{myself.wins} L:{myself.losses})</small>
              </span>
              {/* Кнопки для себя не показываем */}
            </div>
          </>
        )}

        {/* Секция: Онлайн (остальные) */}
        {nonFriends.length > 0 && <div className="friends-header">Онлайн</div>}
        {nonFriends.map(p => {
          const isSelf = p.userId === myId;
          return (
            <div className="player-item" key={p.id}>
              <span>
                {p.nickname}
                <small>(W:{p.wins} L:{p.losses})</small>
              </span>
              {!isSelf && (
                <>
                  {isAdmin && (
                    <>
                      <button onClick={() => onWatchChat(p.userId)} title="Просмотр чата">ℹ️</button>
                      <button onClick={() => onBanConfirm(p.userId, p.nickname)} title="Забанить навсегда">⛔</button>
                    </>
                  )}
                  <button onClick={() => onRequestDuel(p.id)} title="Вызвать на дуэль">⚔️</button>
                  <button onClick={() => onOpenPrivateChat(p.userId, p.nickname)} title="Написать">
                    ✉️
                    {unreadByUser[p.userId] && <span className="unread-excl">!</span>}
                  </button>
                  <button
                    onClick={() => onFriendRequest(p.userId)}
                    title="Добавить в друзья"
                  >
                    🤝
                  </button>
                </>
              )}
            </div>
          );
        })}

        {/* Секция: Друзья */}
        {filteredFriends.length > 0 && <div className="friends-header">Друзья</div>}
        {filteredFriends.map(f => (
          <div className="player-item" key={f.userId}>
            <span>
              {f.nickname}
              {isFriendOnline(f.userId) && <span className="online-status" title="В сети"></span>}
            </span>
            <button onClick={() => onOpenPrivateChat(f.userId, f.nickname)} title="Написать">
              ✉️
              {unreadByUser[f.userId] && <span className="unread-excl">!</span>}
            </button>
            <button onClick={() => onRequestDuel(f.userId)} title="Вызвать на дуэль">⚔️</button>
          </div>
        ))}

        {/* Входящие запросы */}
        {friendRequests.length > 0 && (
          <>
            <div className="friends-header">Входящие запросы</div>
            {friendRequests.map(req => (
              <div className="friend-request-item" key={req.requestId}>
                <span>{req.senderNickname} хочет добавить вас в друзья</span>
                <div className="friend-request-actions">
                  <button className="btn" onClick={() => onAcceptRequest(req.requestId)}>Принять</button>
                  <button className="btn" onClick={() => onDeclineRequest(req.requestId)}>Отклонить</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
});

export default PlayersPanel;