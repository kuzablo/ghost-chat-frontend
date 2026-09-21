import React, { useState, useEffect, useRef } from 'react';
import { getAvatarColor, getInitial } from '../utils';

/*
  [2.20.0] Профиль: bio, аватар, удаление друга.
           Self — редактирование. Other — просмотр + действия.
           Открывается из long-press меню PlayerPanel.
*/

const MAX_BIO = 200;
const MAX_AVATAR_MB = 2;

const ProfilePanel = ({
  data,
  onClose,
  onSave,
  onRemoveFriend,
  onOpenPrivateChat,
  onRequestDuel,
  token,
  apiUrl,
}) => {
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);
  const fileRef = useRef(null);

  // синхронизация при смене data
  useEffect(() => {
    if (!data) return;
    setBio(data.bio || '');
    setAvatarUrl(data.avatarUrl || null);
    setError('');
    setSavedAt(0);
  }, [data?.userId, data?.bio, data?.avatarUrl]);

  if (!data) {
    return (
      <>
        <div className="profile-overlay" onClick={onClose} />
        <div className="profile-panel profile-panel--loading">
          <div className="profile-loading-text">Загрузка…</div>
          <button className="profile-close" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
      </>
    );
  }

  const isSelf = !!data.isSelf;
  const isAdmin = data.role === 'admin';
  const dirty = bio !== (data.bio || '') || (avatarUrl || null) !== (data.avatarUrl || null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Только изображения');
      return;
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setError(`Файл больше ${MAX_AVATAR_MB} МБ`);
      return;
    }

    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('token', token);
      const res = await fetch(`${apiUrl}/api/upload-avatar`, { method: 'POST', body: fd });
      const resp = await res.json();
      if (!res.ok) throw new Error(resp.error || 'Upload failed');
      setAvatarUrl(resp.avatarUrl);
      // авто-сохраняем аватар сразу
      onSave(bio.slice(0, MAX_BIO), resp.avatarUrl);
    } catch (err) {
      setError('Не удалось загрузить: ' + (err?.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!dirty) return;
    onSave(bio.slice(0, MAX_BIO), avatarUrl);
    setSavedAt(Date.now());
  };

  const handleRemoveFriend = () => {
    if (window.confirm(`Удалить ${data.nickname} из друзей?`)) {
      onRemoveFriend(data.userId);
    }
  };

  const avatarStyle = avatarUrl
    ? { backgroundImage: `url(${avatarUrl})` }
    : { background: getAvatarColor(data.nickname) };

  return (
    <>
      <div className="profile-overlay" onClick={onClose} />
      <div className="profile-panel">
        <button className="profile-close" onClick={onClose} aria-label="Закрыть">✕</button>

        <div className="profile-header">
          <div className="profile-avatar" style={avatarStyle}>
            {!avatarUrl && getInitial(data.nickname)}
          </div>
          <div className="profile-name-row">
            <div className="profile-nick">{data.nickname}</div>
            {isAdmin && <div className="profile-role">админ</div>}
          </div>
          <div className="profile-stats">🏆 {data.wins} · 💀 {data.losses}</div>

          {isSelf && (
            <>
              <button
                type="button"
                className="profile-avatar-btn"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Загрузка…' : '📷 Сменить фото'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFile}
              />
            </>
          )}
        </div>

        <div className="profile-body">
          <div className="profile-section-label">О себе</div>
          {isSelf ? (
            <>
              <textarea
                className="profile-bio-input"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
                placeholder="Пара слов о себе…"
                rows={3}
              />
              <div className="profile-bio-count">{bio.length} / {MAX_BIO}</div>
              {error && <div className="profile-error">{error}</div>}
              <button
                className="btn profile-save-btn"
                onClick={handleSave}
                disabled={!dirty || uploading}
              >
                {savedAt && !dirty ? 'Сохранено ✓' : 'Сохранить'}
              </button>
            </>
          ) : (
            <div className="profile-bio-read">
              {data.bio ? data.bio : <i>Пока ничего не рассказал</i>}
            </div>
          )}
        </div>

        {!isSelf && (
          <div className="profile-actions">
            <button
              className="btn profile-action-btn"
              onClick={() => onOpenPrivateChat(data.userId, data.nickname)}
            >
              ✉️ Написать
            </button>
            <button
              className="btn profile-action-btn"
              onClick={() => onRequestDuel()}
            >
              ⚔️ Дуэль
            </button>
            {data.isFriend && (
              <button
                className="btn profile-action-btn profile-action-btn--danger"
                onClick={handleRemoveFriend}
              >
                💔 Удалить из друзей
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ProfilePanel;