import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';

/*
  [2.25.0] contentEditable-инпут. Работает и на iOS Safari
  (не вызывает системный InputAssistant «Автозаполнить контакт»),
  и на десктопе.

  Принцип:
    - React НЕ управляет содержимым (нет children).
    - domValueRef хранит то, что мы сами записали в DOM.
    - useEffect([value]) реагирует ТОЛЬКО на внешние изменения.
      Во время набора domValueRef.current === value → DOM не трогаем,
      каретка не прыгает.
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

  return (
    <div
      ref={elRef}
      className={`chat-input-editable ${value ? '' : 'is-empty'} ${className}`.trim()}
      contentEditable={!isDisabled}
      role="textbox"
      aria-label={placeholder}
      aria-multiline="false"
      aria-disabled={isDisabled}
      data-placeholder={placeholder}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onDrop={handleDrop}
      suppressContentEditableWarning
    />
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;