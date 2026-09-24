import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactionWheel from './ReactionWheel';

/*
  [2.47.1] Fullscreen видео через React Portal в document.body.
           Раньше оверлей рендерился внутри дерева чата, где у .msg-content
           есть transform: scale() — position: fixed схлопывался к предку
           и оверлей не раскрывался. Portal выносит в корень документа.
  [2.45.0] Маскот-плейсхолдер до loadeddata. Автоплей свежих (< 8с).
  [2.42.0] Кружки. Кнопки: play, mute, fullscreen.
*/

const FRESH_WINDOW_MS = 8000;

let currentlyPlayingVideo = null;

const Icon = {
  Play: () => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>),
  Pause: () => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>),
  Mute: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z" /><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></svg>),
  Sound: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>),
  Fullscreen: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>),
  Close: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>),
};

const VideoMessage = ({
  url,
  isOwn = false,
  createdAt = 0,
  messageId = null,
  reactions = null,
  nickname = null,
  onReact = null,
}) => {
  const videoRef = useRef(null);
  const fsVideoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [fsOpen, setFsOpen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [fsWheel, setFsWheel] = useState(null);
  const autoPlayedRef = useRef(false);

  const hasReactions = !!reactions && Object.keys(reactions).length > 0;
  const canReact = !!onReact && !!messageId && !!nickname;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoadedData = () => {
      setVideoReady(true);
      try { if (v.currentTime < 0.01) v.currentTime = 0.001; } catch { /* noop */ }
    };
    if (v.readyState >= 2) onLoadedData();
    else v.addEventListener('loadeddata', onLoadedData, { once: true });
    return () => v.removeEventListener('loadeddata', onLoadedData);
  }, []);

  useEffect(() => {
    if (autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    const ts = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt);
    if (!ts || Number.isNaN(ts)) return;
    if (Date.now() - ts > FRESH_WINDOW_MS) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    setMuted(true);
    if (currentlyPlayingVideo && currentlyPlayingVideo !== v) {
      try { currentlyPlayingVideo.pause(); } catch { /* noop */ }
    }
    v.play().then(() => { currentlyPlayingVideo = v; setPlaying(true); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (!v) return;
      try { v.pause(); } catch { /* noop */ }
      if (currentlyPlayingVideo === v) currentlyPlayingVideo = null;
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (v && fsOpen) { try { v.pause(); } catch { /* noop */ } setPlaying(false); }
  }, [fsOpen]);

  // Esc закрывает fullscreen
  useEffect(() => {
    if (!fsOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') { setFsOpen(false); setFsWheel(null); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fsOpen]);

  const handlePlayToggle = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      try { v.pause(); } catch { /* noop */ }
      setPlaying(false);
      if (currentlyPlayingVideo === v) currentlyPlayingVideo = null;
    } else {
      if (currentlyPlayingVideo && currentlyPlayingVideo !== v) {
        try { currentlyPlayingVideo.pause(); } catch { /* noop */ }
      }
      currentlyPlayingVideo = v;
      v.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const handleMuteToggle = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
    const fv = fsVideoRef.current;
    if (fv) fv.muted = next;
  };

  const openFs = (e) => { e.stopPropagation(); setFsOpen(true); };
  const closeFs = (e) => { if (e) e.stopPropagation(); setFsOpen(false); setFsWheel(null); };

  const reactionEntries = hasReactions ? Object.entries(reactions) : [];

  const handleToggleWheel = (e) => {
    e.stopPropagation();
    if (fsWheel) { setFsWheel(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setFsWheel({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  const handlePick = (emoji) => {
    if (onReact && messageId) onReact(messageId, emoji);
    setFsWheel(null);
  };

  const fullscreenNode = fsOpen ? (
    <div className="fullscreen-overlay" onClick={closeFs}>
      <div className="fs-topbar" onClick={(e) => e.stopPropagation()}>
        <div className="fs-author" />
        <button className="fs-close" onClick={closeFs} aria-label="Закрыть">
          <Icon.Close />
        </button>
      </div>

      <div className="fs-stage" onClick={closeFs}>
        <video
          ref={fsVideoRef}
          src={url}
          className="fs-image"
          autoPlay
          playsInline
          controls
          muted={muted}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {(hasReactions || canReact) && (
        <div className="fs-bottombar" onClick={(e) => e.stopPropagation()}>
          {hasReactions && (
            <div className="fs-reactions-strip">
              {reactionEntries.map(([emoji, users]) => (
                <span
                  key={emoji}
                  className={`fs-reaction-badge ${users.includes(nickname) ? 'own' : ''}`}
                >
                  <span className="fs-reaction-badge-emoji">{emoji}</span>
                  <span className="fs-reaction-badge-count">{users.length}</span>
                </span>
              ))}
            </div>
          )}
          {canReact && (
            <button
              type="button"
              className={`fs-reaction-toggle ${fsWheel ? 'active' : ''}`}
              onClick={handleToggleWheel}
              aria-label="Реакции"
            >
              😀
            </button>
          )}
        </div>
      )}

      {fsWheel && canReact && (
        <ReactionWheel
          open
          anchorX={fsWheel.x}
          anchorY={fsWheel.y}
          reactions={reactions || {}}
          nickname={nickname}
          onPick={handlePick}
          onClose={() => setFsWheel(null)}
          ignoreSelector=".fs-reaction-toggle"
        />
      )}
    </div>
  ) : null;

  return (
    <>
      <div className={`video-msg ${isOwn ? 'video-msg--own' : ''}`}>
        <div className="video-msg-square">
          <video
            ref={videoRef}
            src={url}
            className="video-msg-video"
            playsInline
            preload="auto"
            muted={muted}
            onClick={handlePlayToggle}
          />

          {!videoReady && (
            <div className="video-msg-ph" aria-hidden="true">
              <div className="video-msg-ph-mascot" />
            </div>
          )}

          {!playing && videoReady && (
            <button
              type="button"
              className="video-msg-play"
              onClick={handlePlayToggle}
              aria-label="Воспроизвести"
            >
              <Icon.Play />
            </button>
          )}

          <div className="video-msg-controls">
            <button
              type="button"
              className="video-msg-btn"
              onClick={handleMuteToggle}
              aria-label={muted ? 'Включить звук' : 'Выключить звук'}
              title={muted ? 'Включить звук' : 'Выключить звук'}
            >
              {muted ? <Icon.Mute /> : <Icon.Sound />}
            </button>
            <button
              type="button"
              className="video-msg-btn"
              onClick={openFs}
              aria-label="На весь экран"
              title="На весь экран"
            >
              <Icon.Fullscreen />
            </button>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' && fullscreenNode
        ? createPortal(fullscreenNode, document.body)
        : fullscreenNode}
    </>
  );
};

export default VideoMessage;