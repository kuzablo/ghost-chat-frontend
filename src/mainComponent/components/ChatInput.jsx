import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';

/*
  [2.25.1] placeholder вынесен из contentEditable — отдельным span-слоем.
  [2.25.0] contentEditable-инпут. iOS Safari не вызывает InputAssistant.
*/
const ChatInput = forwardRef(({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = '',
  className = '',
  maxLength,
}, ref) => {
  const elRef = useRef(null);
  const domValueRef = useRef('');

  useImperativeHandle(ref, () => ({
    focus: (opts) => elRef.current?.focus(opts),
    blur: () => elRef.current?.blur(),
    getEl: () => elRef.current,
  }), []);

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

    onChange(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend?.();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const raw = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
    const clean = raw.replace(/\s+/g, ' ').trim();
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
        onPaste={handlePaste}
        onDrop={handleDrop}
        suppressContentEditableWarning
      />
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;