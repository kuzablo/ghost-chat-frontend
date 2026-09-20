import { forwardRef } from 'react';
import { getAvatarColor, getInitial } from '../utils';

/*
  [2.19.3] Добавлена кнопка logout в секцию «Вы».
  Prop onLogout → открывает confirm modal в Chat.jsx.
  myself берётся из players, а не из filteredPlayers — чтобы кнопка
  не пропадала при поиске по другому нику.
*/
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
  onOpenInfo,
  onLogout,
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
  // [2.19.3] свой профиль ищем в полном списке, чтобы кнопка logout была всегда
  const myself = players.find(p => p.userId === myId);

  return (
    <div className="players-overlay" ref={ref}>
      <h4>banjoboy's crew</h4>
      <input
        className="search-input"
        type="text"
        placeholder="Поиск по нику..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="players-list">

        {/* Секция: Вы */}
        {myself && (
          <>
            <div className="friends-header">Вы</div>
            <div className="player-item">
              <div
                className="player-avatar"
                style={{ background: getAvatarColor(myself.nickname) }}
              >
                {getInitial(myself.nickname)}
              </div>
              <span className="player-name">
                {myself.nickname}
                <small className="player-stats">W:{myself.wins} L:{myself.losses}</small>
              </span>
              {onLogout && (
                <div className="player-actions">
                  <button
                    className="player-action-btn player-action-btn--danger"
                    onClick={onLogout}
                    title="Выйти из аккаунта"
                  >
                    🚪
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Секция: Онлайн */}
        {nonFriends.length > 0 && (
          <div className="friends-header">Онлайн ({nonFriends.length})</div>
        )}
        {nonFriends.map(p => {
          const isSelf = p.userId === myId;
          return (
            <div className="player-item" key={p.id}>
              <div
                className="player-avatar"
                style={{ background: getAvatarColor(p.nickname) }}
              >
                {getInitial(p.nickname)}
              </div>
              <span className="player-name">
                {p.nickname}
                <small className="player-stats">W:{p.wins} L:{p.losses}</small>
              </span>
              {!isSelf && (
                <div className="player-actions">
                  {isAdmin && (
                    <>
                      <button
                        className="player-action-btn"
                        onClick={() => onWatchChat(p.userId)}
                        title="Просмотр чата"
                      >
                        ℹ️
                      </button>
                      <button
                        className="player-action-btn player-action-btn--danger"
                        onClick={() => onBanConfirm(p.userId, p.nickname)}
                        title="Забанить навсегда"
                      >
                        ⛔
                      </button>
                    </>
                  )}
                  <button
                    className="player-action-btn"
                    onClick={() => onRequestDuel(p.id)}
                    title="Вызвать на дуэль"
                  >
                    ⚔️
                  </button>
                  <button
                    className={`player-action-btn ${unreadByUser[p.userId] ? 'player-action-btn--unread' : ''}`}
                    onClick={() => onOpenPrivateChat(p.userId, p.nickname)}
                    title="Написать"
                  >
                    ✉️
                  </button>
                  <button
                    className="player-action-btn"
                    onClick={() => onFriendRequest(p.userId)}
                    title="Добавить в друзья"
                  >
                    🤝
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Секция: Друзья */}
        {filteredFriends.length > 0 && (
          <div className="friends-header">Друзья ({filteredFriends.length})</div>
        )}
        {filteredFriends.map(f => (
          <div className="player-item" key={f.userId}>
            <div
              className="player-avatar"
              style={{ background: getAvatarColor(f.nickname) }}
            >
              {getInitial(f.nickname)}
            </div>
            <span className="player-name">
              {f.nickname}
              {isFriendOnline(f.userId) && <span className="online-status" title="В сети" />}
            </span>
            <div className="player-actions">
              <button
                className={`player-action-btn ${unreadByUser[f.userId] ? 'player-action-btn--unread' : ''}`}
                onClick={() => onOpenPrivateChat(f.userId, f.nickname)}
                title="Написать"
              >
                ✉️
              </button>
              <button
                className="player-action-btn"
                onClick={() => onRequestDuel(f.userId)}
                title="Вызвать на дуэль"
              >
                ⚔️
              </button>
            </div>
          </div>
        ))}

        {/* Входящие запросы */}
        {friendRequests.length > 0 && (
          <>
            <div className="friends-header">Входящие запросы ({friendRequests.length})</div>
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

        {/* Ссылка внизу панели */}
        {onOpenInfo && (
          <button
            type="button"
            className="players-info-link"
            onClick={onOpenInfo}
          >
            Что умеет чат?
          </button>
        )}
      </div>
    </div>
  );
});

export default PlayersPanel;