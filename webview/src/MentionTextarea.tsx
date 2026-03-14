import React, { useCallback, useEffect, useRef, useState } from 'react';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  knownNames: string[];
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  knownNames,
  placeholder,
  rows = 3,
  autoFocus,
  className,
  style,
  'aria-label': ariaLabel,
}: MentionTextareaProps): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const listboxId = useRef(`mention-listbox-${Math.random().toString(36).slice(2)}`).current;
  // The character position in `value` where the current @-query starts (including the @)
  const mentionStartRef = useRef<number | null>(null);

  const closeSuggestions = useCallback(() => {
    setSuggestions([]);
    setActiveSuggestion(0);
    mentionStartRef.current = null;
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      const cursor = e.target.selectionStart ?? text.length;
      onChange(text);

      // Detect an active @-query: scan backwards from cursor for @
      const textBefore = text.slice(0, cursor);
      const atIndex = textBefore.lastIndexOf('@');

      if (atIndex !== -1) {
        // Only trigger if @ is at the start or preceded by whitespace
        const charBefore = atIndex > 0 ? textBefore[atIndex - 1] : ' ';
        if (/\s/.test(charBefore) || atIndex === 0) {
          const query = textBefore.slice(atIndex + 1).toLowerCase();
          // Don't show suggestions if there's a space in the query (mention already completed)
          if (!query.includes(' ') || query === '') {
            const matches = knownNames.filter((n) =>
              n.toLowerCase().startsWith(query),
            );
            if (matches.length > 0) {
              mentionStartRef.current = atIndex;
              setSuggestions(matches);
              setActiveSuggestion(0);
              return;
            }
          }
        }
      }
      closeSuggestions();
    },
    [onChange, knownNames, closeSuggestions],
  );

  const insertMention = useCallback(
    (name: string) => {
      if (mentionStartRef.current === null) return;
      const cursor = textareaRef.current?.selectionStart ?? value.length;
      // Replace from mentionStart to cursor with @Name
      const before = value.slice(0, mentionStartRef.current);
      const after = value.slice(cursor);
      const newValue = `${before}@${name} ${after}`;
      onChange(newValue);
      closeSuggestions();
      // Restore focus and move cursor to after the inserted mention
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newCursor = before.length + name.length + 2; // @Name + space
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      });
    },
    [value, onChange, closeSuggestions],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveSuggestion((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertMention(suggestions[activeSuggestion]);
          return;
        }
        if (e.key === 'Escape') {
          closeSuggestions();
          return;
        }
      }
      onKeyDown?.(e);
    },
    [suggestions, activeSuggestion, insertMention, closeSuggestions, onKeyDown],
  );

  // Close dropdown if clicked outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        closeSuggestions();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [closeSuggestions]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className={className}
        style={style}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={suggestions.length > 0}
        aria-autocomplete="list"
        aria-controls={suggestions.length > 0 ? listboxId : undefined}
        aria-activedescendant={
          suggestions.length > 0 ? `${listboxId}-option-${activeSuggestion}` : undefined
        }
      />
      {suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute z-50 w-48 rounded shadow-xl overflow-hidden"
          style={{
            bottom: '100%',
            left: 0,
            marginBottom: '4px',
            background: 'var(--vscode-editorWidget-background, #252526)',
            border: '1px solid var(--vscode-panel-border, #454545)',
          }}
        >
          {suggestions.map((name, i) => (
            <li
              key={name}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeSuggestion}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(name);
              }}
              className="px-3 py-1.5 text-xs cursor-pointer truncate"
              style={{
                background: i === activeSuggestion
                  ? 'var(--vscode-list-activeSelectionBackground, #094771)'
                  : 'transparent',
                color: i === activeSuggestion
                  ? 'var(--vscode-list-activeSelectionForeground, #fff)'
                  : 'var(--vscode-foreground, #ccc)',
              }}
            >
              @{name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
