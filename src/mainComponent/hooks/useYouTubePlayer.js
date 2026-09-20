import { useEffect, useRef, useState, useCallback } from 'react';

/*
  [правка 2.15.19]
  iOS Safari требует реального user gesture ВНУТРИ iframe.
  Скрытый iframe 1×1 не подходит. Пробуем:
    - iframe с реальным размером 200×200 в углу экрана (невидим по opacity);
    - mute() → playVideo() → unMute() через 80мс;
    - allow="autoplay; encrypted-media" на iframe;
    - origin в playerVars.
*/

const PLAYLIST = [
  'dn_HJ0G3JXI',
  'rY8drrmx4k4',
  '6gRXToZhO1A',
];

let ytApiPromise = null;
const loadYouTubeApi = () => {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve(window.YT);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
};

export const useYouTubePlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(50);
  const [trackIndex, setTrackIndex] = useState(0);
  const [trackTitle, setTrackTitle] = useState('');
  const [ready, setReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const playerRef = useRef(null);
  const containerIdRef = useRef(
    `yt-host-${Math.random().toString(36).slice(2)}`
  );
  const volumeRef = useRef(volume);
  const trackIndexRef = useRef(trackIndex);
  const pendingActionRef = useRef(null);

  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { trackIndexRef.current = trackIndex; }, [trackIndex]);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      const host = document.getElementById(containerIdRef.current);
      if (!host) return;

      playerRef.current = new YT.Player(containerIdRef.current, {
        height: '200',
        width: '200',
        videoId: PLAYLIST[0],
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            setReady(true);
            e.target.setVolume(volumeRef.current);

            // ставим allow на созданный iframe
            try {
              const iframe = host.querySelector('iframe');
              if (iframe) {
                iframe.setAttribute('allow', 'autoplay; encrypted-media');
                iframe.setAttribute('allowfullscreen', '0');
              }
            } catch (err) { /* noop */ }

            const pending = pendingActionRef.current;
            pendingActionRef.current = null;
            if (pending === 'play') {
              safePlay(e.target);
            } else if (pending === 'next') {
              const nextIdx = (trackIndexRef.current + 1) % PLAYLIST.length;
              setTrackIndex(nextIdx);
              try {
                e.target.loadVideoById(PLAYLIST[nextIdx]);
                safePlay(e.target);
              } catch (err) { /* noop */ }
            }
          },
          onStateChange: (e) => {
            try {
              const data = e.target.getVideoData?.();
              if (data?.title) setTrackTitle(data.title);
            } catch (err) { /* noop */ }

            if (e.data === 1) {
              setIsPlaying(true);
              setHasStarted(true);
            } else if (e.data === 2) {
              setIsPlaying(false);
            } else if (e.data === 0) {
              const nextIdx = (trackIndexRef.current + 1) % PLAYLIST.length;
              setTrackIndex(nextIdx);
              playerRef.current?.loadVideoById(PLAYLIST[nextIdx]);
              playerRef.current?.playVideo();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch (e) { /* noop */ }
      playerRef.current = null;
    };
  }, []);

  // mute → play → unmute: iOS пускает mьютный autoplay всегда
  const safePlay = useCallback((p) => {
    try {
      p.mute();
      p.playVideo();
      setTimeout(() => {
        try {
          p.unMute();
          p.setVolume(volumeRef.current);
        } catch (err) { /* noop */ }
      }, 80);
    } catch (err) {
      try { p.playVideo(); } catch (e) { /* noop */ }
    }
  }, []);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;

    if (!ready) {
      pendingActionRef.current = 'play';
      return;
    }

    const state = p.getPlayerState?.();
    if (state === 1) p.pauseVideo();
    else safePlay(p);
  }, [ready, safePlay]);

  const next = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;

    if (!ready) {
      pendingActionRef.current = 'next';
      return;
    }

    const nextIdx = (trackIndexRef.current + 1) % PLAYLIST.length;
    setTrackIndex(nextIdx);
    try {
      p.loadVideoById(PLAYLIST[nextIdx]);
      safePlay(p);
    } catch (err) { try { p.playVideo(); } catch (e) { /* noop */ } }
  }, [ready, safePlay]);

  const setVolume = useCallback((v) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setVolumeState(clamped);
    playerRef.current?.setVolume?.(clamped);
  }, []);

  return {
    isPlaying,
    volume,
    trackIndex,
    trackTitle,
    ready,
    hasStarted,
    containerId: containerIdRef.current,
    toggle,
    next,
    setVolume,
  };
};