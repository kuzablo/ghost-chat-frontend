/*
  [2.35.57] Полоса записи — появляется над инпутом во время long-press.
  Свайп влево — отмена.
*/

const VoiceRecordingBar = ({ duration = 0, level = 0, cancelled = false }) => {
  const sec = Math.floor(duration);
  const mm = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');

  return (
    <div
      className={`voice-rec-bar ${cancelled ? 'voice-rec-bar--cancel' : ''}`}
      style={{ '--voice-level': Math.max(0.2, Math.min(1, level)) }}
    >
      <span className="voice-rec-dot" aria-hidden="true" />
      <span className="voice-rec-time">{mm}:{ss}</span>
      <div className="voice-rec-wave" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="voice-rec-wave-col"
            style={{ animationDelay: `${(i % 5) * 0.1}s` }}
          />
        ))}
      </div>
      <span className="voice-rec-hint">
        {cancelled ? 'Отпусти — отмена' : '← отмена'}
      </span>
    </div>
  );
};

export default VoiceRecordingBar;