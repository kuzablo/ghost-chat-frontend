import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';

/*
  [2.26.1] draftKey — опциональный. null → черновик не используется.
  [2.26.0] IME composition fix, черновик в localStorage, лимит длины.
  [2.25.1] placeholder отдельным span-слоем — каретка в начале.
  [2.25.0] contentEditable вместо <input>.
*/

const DEFAULT_DRAFT_KEY = 'ghost-chat-draft';
const MAX_LENGTH = 2000;

const ChatInput = forwardRef(({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = '',
  className = '',
  maxLength = MAX_LENGTH,
  draftKey = DEFAULT_DRAFT_KEY,
}, ref) => {
  const elRef = useRef(null);
  const domValueRef = useRef('');
  const composingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    focus: (opts) => elRef.current?.focus(opts),
    blur: () => elRef.current?.blur(),
    getEl: () => elRef.current,
  }), []);

  /* Черновик: восстановить при монтировании */
  useEffect(() => {
    if (!draftKey) return;
    const el = elRef.current;
    if (!el) return;
    let draft = '';
    try {
      draft = localStorage.getItem(draftKey) || '';
    } catch { /* noop */ }

    if (draft && !value) {
      el.textContent = draft;
      domValueRef.current = draft;
      onChange(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (domValueRef.current === value) return;

    el.textContent = value;
    domValueRef.current = value;

    if (document.activeElement === el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [value]);

  const persistDraft = (text) => {
    if (!draftKey) return;
    try {
      if (text) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch { /* noop */ }
  };

  const setText = (text) => {
    const el = elRef.current;
    if (!el) return;
    el.textContent = text;
    domValueRef.current = text;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const handleInput = (e) => {
    const el = e.currentTarget;
    let text = el.textContent || '';

    if (text.includes('\n')) {
      text = text.replace(/\n+/g, ' ').trim();
      setText(text);
    } else if (maxLength && text.length > maxLength) {
      text = text.slice(0, maxLength);
      setText(text);
    } else {
      domValueRef.current = text;
    }

    persistDraft(text);
    onChange(text);
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent?.isComposing || composingRef.current) return;
    if (e.key !== 'Enter') return;

    e.preventDefault();
    if (!disabled && value.trim()) {
      persistDraft('');
      onSend?.();
    }
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };
  const handleCompositionEnd = () => {
    composingRef.current = false;
  };

  const handlePaste = (e) => {
    e.preventDefault();
    let raw = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
    let clean = raw.replace(/\s+/g, ' ').trim();
    if (maxLength && clean.length > maxLength) {
      clean = clean.slice(0, maxLength);
    }
    if (!clean) return;
    document.execCommand('insertText', false, clean);
  };

  const handleDrop = (e) => e.preventDefault();

  const isDisabled = !!disabled;
  const showPlaceholder = !value && !!placeholder;

  return (
    <div className={`chat-input-wrap ${className}`.trim()}>
      {showPlaceholder && (
        <span className="chat-input-placeholder" aria-hidden="true">
          {placeholder}
        </span>
      )}
      <div
        ref={elRef}
        className="chat-input-editable"
        contentEditable={!isDisabled}
        role="textbox"
        aria-label={placeholder}
        aria-multiline="false"
        aria-disabled={isDisabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        onDrop={handleDrop}
        suppressContentEditableWarning
      />
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;