import { useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  autoFocus?: boolean
}

interface Tool {
  label: string
  title: string
  action: (value: string, start: number, end: number) => { value: string; start: number; end: number }
}

function wrapSelection(value: string, start: number, end: number, before: string, after: string) {
  const selected = value.slice(start, end)
  return {
    value: value.slice(0, start) + before + selected + after + value.slice(end),
    start: start + before.length,
    end: end + before.length,
  }
}

function prefixLine(value: string, start: number, end: number, prefix: string) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  return {
    value: value.slice(0, lineStart) + prefix + value.slice(lineStart),
    start: start + prefix.length,
    end: end + prefix.length,
  }
}

function insertSnippet(value: string, start: number, _end: number, snippet: string) {
  const newValue = value.slice(0, start) + snippet + value.slice(start)
  const cursor = start + snippet.length
  return { value: newValue, start: cursor, end: cursor }
}

const TOOLS: Tool[] = [
  {
    label: 'B',
    title: 'Bold (Ctrl+B)',
    action: (v, s, e) => wrapSelection(v, s, e, '**', '**'),
  },
  {
    label: 'I',
    title: 'Italic (Ctrl+I)',
    action: (v, s, e) => wrapSelection(v, s, e, '*', '*'),
  },
  {
    label: 'S',
    title: 'Strikethrough',
    action: (v, s, e) => wrapSelection(v, s, e, '~~', '~~'),
  },
  { label: '|', title: 'separator', action: (v, s, e) => ({ value: v, start: s, end: e }) },
  {
    label: 'H1',
    title: 'Heading 1',
    action: (v, s, e) => prefixLine(v, s, e, '# '),
  },
  {
    label: 'H2',
    title: 'Heading 2',
    action: (v, s, e) => prefixLine(v, s, e, '## '),
  },
  { label: '|', title: 'separator', action: (v, s, e) => ({ value: v, start: s, end: e }) },
  {
    label: '•',
    title: 'Bullet list',
    action: (v, s, e) => prefixLine(v, s, e, '- '),
  },
  {
    label: '❝',
    title: 'Blockquote',
    action: (v, s, e) => prefixLine(v, s, e, '> '),
  },
  {
    label: '—',
    title: 'Horizontal rule',
    action: (v, s, e) => insertSnippet(v, s, e, '\n---\n'),
  },
  {
    label: '⊞',
    title: 'Insert table',
    action: (v, s, e) => insertSnippet(v, s, e, '\n| Kolumna 1 | Kolumna 2 | Kolumna 3 |\n|-----------|-----------|----------|\n| Wiersz 1  |           |           |\n'),
  },
]

export default function RichTextEditor({ value, onChange, placeholder, rows = 6, autoFocus }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function applyTool(tool: Tool) {
    const el = ref.current
    if (!el || tool.label === '|') return
    const result = tool.action(value, el.selectionStart, el.selectionEnd)
    onChange(result.value)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(result.start, result.end)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); applyTool(TOOLS[0]) }
      if (e.key === 'i') { e.preventDefault(); applyTool(TOOLS[1]) }
    }
  }

  return (
    <div className="flex flex-col rounded border border-border focus-within:border-blood focus-within:ring-1 focus-within:ring-blood/40">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-elevated rounded-t">
        {TOOLS.map((tool, i) =>
          tool.label === '|' ? (
            <div key={i} className="w-px h-4 bg-border mx-1 shrink-0" />
          ) : (
            <button
              key={i}
              type="button"
              title={tool.title}
              onMouseDown={(e) => { e.preventDefault(); applyTool(tool) }}
              className={`
                min-w-[26px] h-6 px-1 flex items-center justify-center
                text-xs text-ink-muted hover:text-ink hover:bg-surface
                rounded transition-colors leading-none
                ${tool.label === 'B' ? 'font-bold font-heading' : ''}
                ${tool.label === 'I' ? 'italic' : ''}
              `}
            >
              {tool.label}
            </button>
          )
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Textarea */}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className="bg-surface rounded-b px-3 py-2 text-sm text-ink
          font-mono placeholder-ink-faint resize-y focus:outline-none"
      />
    </div>
  )
}
