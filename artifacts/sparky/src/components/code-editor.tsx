import { useEffect, useRef } from "react";

export function CodeEditor({
  value,
  onChange,
  language,
  cursorPosition,
  onCursorChange,
}: {
  value: string;
  onChange: (v: string) => void;
  language: string;
  cursorPosition: number;
  onCursorChange: (position: number) => void;
}) {
  const escaped = useRef(false);
  const gutter = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const lines = value.split("\n").length;

  useEffect(() => {
    const el = editor.current;
    if (!el || document.activeElement !== el) return;
    el.setSelectionRange(cursorPosition, cursorPosition);
  }, [value, cursorPosition]);

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[hsl(222_22%_14%)] font-mono text-[13px] leading-6 text-[hsl(40_25%_90%)]">
      <div ref={gutter} aria-hidden className="select-none overflow-hidden border-r border-white/10 px-3 py-3 text-right text-white/30">
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea
        ref={editor}
        data-testid="input-code"
        aria-label={`Code editor, ${language}. Tab inserts spaces; press Escape then Tab to move focus out.`}
        aria-describedby="editor-help"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        value={value}
        onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { escaped.current = true; return; }
          if (e.key === "Tab" && !escaped.current && !e.shiftKey) {
            e.preventDefault();
            const t = e.currentTarget;
            const s = t.selectionStart, en = t.selectionEnd;
            const next = value.slice(0, s) + "  " + value.slice(en);
            onChange(next);
            requestAnimationFrame(() => {
              t.selectionStart = t.selectionEnd = s + 2;
              onCursorChange(s + 2);
            });
            return;
          }
          escaped.current = false;
        }}
        onSelect={(e) => onCursorChange(e.currentTarget.selectionStart)}
        onClick={(e) => onCursorChange(e.currentTarget.selectionStart)}
        onKeyUp={(e) => onCursorChange(e.currentTarget.selectionStart)}
        onFocus={(e) => e.currentTarget.setSelectionRange(cursorPosition, cursorPosition)}
        onChange={(e) => {
          onCursorChange(e.currentTarget.selectionStart);
          onChange(e.target.value);
        }}
        className="min-h-0 flex-1 resize-none whitespace-pre bg-transparent px-4 py-3 caret-[hsl(14_85%_60%)] outline-none selection:bg-[hsl(14_78%_47%/0.35)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(14_78%_55%)]"
        placeholder="// Start writing code for the current task. Sparky never runs it — it only reads it."
      />
      <span id="editor-help" className="sr-only">Code is autosaved. Code is never executed.</span>
    </div>
  );
}
