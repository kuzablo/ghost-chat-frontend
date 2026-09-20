import { forwardRef, useState, useRef, useEffect } from 'react';
import { getAvatarColor, getInitial } from '../utils';
import StickerMenu from './StickerMenu';

/*
  [2.20.4] Изменения:
    - long-press 0.5с на элементе → меню стикеров по центру;
    - убрана нижняя кнопка «Мои диалоги» — доступна через long-press
      на секции «Вы»;
    - ссылка «Что умеет чат?» осталась;
    - на ПК обычные кнопки действий остаются (мобилка скрывает через CSS).
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
  onOpenDialogs,
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
  const myself = players.find(p => p.userId === myId);

  const [pressingId, setPressingId] = useState(null);
  const [menuTarget, setMenuTarget] = useState(null);
  const pressRef = useRef({ timer: null, startX: 0, startY: 0, fired: false, id: null });

  const LONG_PRESS_MS = 500;
  const MOVE_CANCEL_PX = 8;

  const cancelPress = () => {
    if (pressRef.current.timer) {
      clearTimeout(pressRef.current.timer);
      pressRef.current.timer = null;
    }
    setPressingId(null);
  };

  useEffect(() => () => cancelPress(), []);

  const openMenuForSelf = () => {
    const items = [];
    if (onOpenDialogs) {
      items.push({ icon: '💬', label: 'Диалоги', onClick: onOpenDialogs });
    }
    if (onLogout) {
      items.push({ icon: '🚪', label: 'Выйти', onClick: onLogout, danger: true });
    }
    setMenuTarget({ title: myself?.nickname || 'Вы', subtitle: 'Действия', items });
  };

  const openMenuForPlayer = (p) => {
    const items = [];
    if (isAdmin) {
      items.push({ icon: 'ℹ️', label: 'Инфо', onClick: () => onWatchChat(p.userId) });
    }
    items.push({ icon: '✉️', label: 'Написать', onClick: () => onOpenPrivateChat(p.userId, p.nickname) });
    items.push({ icon: '⚔️', label: 'Дуэль', onClick: () => onRequestDuel(p.id) });
    items.push({ icon: '🤝', label: 'В друзья', onClick: () => onFriendRequest(p.userId) });
    if (isAdmin) {
      items.push({ icon: '⛔', label: 'Забанить', onClick: () => onBanConfirm(p.userId, p.nickname), danger: true });
    }
    setMenuTarget({ title: p.nickname, subtitle: 'Действия', items });
  };

  const openMenuForFriend = (f) => {
    const items = [
      { icon: '✉️', label: 'Написать', onClick: () => onOpenPrivateChat(f.userId, f.nickname) },
      { icon: '⚔️', label: 'Дуэль', onClick: () => onRequestDuel(f.userId) },
    ];
    setMenuTarget({ title: f.nickname, subtitle: 'Друг', items });
  };

  const startPress = (id, e, onFire) => {
    if (e.target.closest('.player-action-btn')) return;
    if (e.target.closest('.players-info-link')) return;
    const t = e.touches ? e.touches[0] : e;
    pressRef.current.startX = t.clientX;
    pressRef.current.startY = t.clientY;
    pressRef.current.id = id;
    pressRef.current.fired = false;
    setPressingId(id);
    pressRef.current.timer = setTimeout(() => {
      pressRef.current.timer = null;
      pressRef.current.fired = true;
      setPressingId(null);
      onFire();
    }, LONG_PRESS_MS);
  };

  const movePress = (e) => {
    if (!pressRef.current.timer) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - pressRef.current.startX;
    const dy = t.clientY - pressRef.current.startY;
    if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
      cancelPress();
    }
  };

  const endPress = () => {
    cancelPress();
  };

  const isPressing = (id) => pressingId === id;

  return (
    <>
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
              <div
                className={`player-item ${isPressing(`self-${myself.userId}`) ? 'player-item--pressing' : ''}`}
                onTouchStart={(e) => startPress(`self-${myself.userId}`, e, openMenuForSelf)}
                onTouchMove={movePress}
                onTouchEnd={endPress}
                onTouchCancel={endPress}
                onMouseDown={(e) => startPress(`self-${myself.userId}`, e, openMenuForSelf)}
                onMouseMove={movePress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
              >
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
                      onClick={(e) => { e.stopPropagation(); onLogout(); }}
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
            const pid = `p-${p.id}`;
            return (
              <div
                className={`player-item ${isPressing(pid) ? 'player-item--pressing' : ''}`}
                key={p.id}
                onTouchStart={(e) => !isSelf && startPress(pid, e, () => openMenuForPlayer(p))}
                onTouchMove={movePress}
                onTouchEnd={endPress}
                onTouchCancel={endPress}
                onMouseDown={(e) => !isSelf && startPress(pid, e, () => openMenuForPlayer(p))}
                onMouseMove={movePress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
              >
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
                          onClick={(e) => { e.stopPropagation(); onWatchChat(p.userId); }}
                          title="Просмотр чата"
                        >
                          ℹ️
                        </button>
                        <button
                          className="player-action-btn player-action-btn--danger"
                          onClick={(e) => { e.stopPropagation(); onBanConfirm(p.userId, p.nickname); }}
                          title="Забанить навсегда"
                        >
                          ⛔
                        </button>
                      </>
                    )}
                    <button
                      className="player-action-btn"
                      onClick={(e) => { e.stopPropagation(); onRequestDuel(p.id); }}
                      title="Вызвать на дуэль"
                    >
                      ⚔️
                    </button>
                    <button
                      className={`player-action-btn ${unreadByUser[p.userId] ? 'player-action-btn--unread' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onOpenPrivateChat(p.userId, p.nickname); }}
                      title="Написать"
                    >
                      ✉️
                    </button>
                    <button
                      className="player-action-btn"
                      onClick={(e) => { e.stopPropagation(); onFriendRequest(p.userId); }}
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
          {filteredFriends.map(f => {
            const pid = `f-${f.userId}`;
            return (
              <div
                className={`player-item ${isPressing(pid) ? 'player-item--pressing' : ''}`}
                key={f.userId}
                onTouchStart={(e) => startPress(pid, e, () => openMenuForFriend(f))}
                onTouchMove={movePress}
                onTouchEnd={endPress}
                onTouchCancel={endPress}
                onMouseDown={(e) => startPress(pid, e, () => openMenuForFriend(f))}
                onMouseMove={movePress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
              >
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
                    onClick={(e) => { e.stopPropagation(); onOpenPrivateChat(f.userId, f.nickname); }}
                    title="Написать"
                  >
                    ✉️
                  </button>
                  <button
                    className="player-action-btn"
                    onClick={(e) => { e.stopPropagation(); onRequestDuel(f.userId); }}
                    title="Вызвать на дуэль"
                  >
                    ⚔️
                  </button>
                </div>
              </div>
            );
          })}

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

          {/* [2.20.4] Нижняя ссылка — только «Что умеет чат?».
              «Мои диалоги» — в long-press меню по секции «Вы». */}
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

      <StickerMenu
        open={!!menuTarget}
        title={menuTarget?.title}
        subtitle={menuTarget?.subtitle}
        items={menuTarget?.items || []}
        onClose={() => setMenuTarget(null)}
      />
    </>
  );
});

export default PlayersPanel;