import { useEditor } from '../store'

// ============================================================
// 富文本：解析 [[词条]] 为可点击的辞典超链接
// 点击后弹出对应专有名词的解释窗口
// ============================================================

interface Part {
  kind: 'text' | 'link'
  text: string
  entryId?: string
}

function parse(text: string, terms: { id: string; term: string; aliases: string }[]): Part[] {
  const parts: Part[] = []
  const re = /\[\[([^\]]+)\]\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: text.slice(last, m.index) })
    const raw = m[1].trim()
    const entry = terms.find((t) => t.term === raw || t.aliases.split(/[,，]/).map((s) => s.trim()).includes(raw))
    parts.push({ kind: 'link', text: raw, entryId: entry?.id })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts
}

export default function RichText({ text, accentColor = '#7fd4c8' }: { text: string; accentColor?: string }): JSX.Element {
  const { project, setActiveDictTerm } = useEditor()
  const parts = parse(text, project.dictionary)

  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((p, i) => {
        if (p.kind === 'text') return <span key={i}>{p.text}</span>
        const found = p.entryId ? project.dictionary.find((d) => d.id === p.entryId) : undefined
        return (
          <span
            key={i}
            style={{
              color: accentColor,
              textDecoration: 'underline',
              textUnderlineOffset: 4,
              cursor: found ? 'pointer' : 'help'
            }}
            title={found ? `查看「${found.term}」` : '辞典中未收录该词条'}
            onClick={(e) => {
              e.stopPropagation()
              if (p.entryId) setActiveDictTerm(p.entryId)
            }}
          >
            {p.text}
          </span>
        )
      })}
    </span>
  )
}
