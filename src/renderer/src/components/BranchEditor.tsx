import { useMemo, useState } from 'react'
import { useEditor } from '../store'
import type { Project } from '../model'

// ============================================================
// 剧情分支可视化编辑器：把片段绘制为节点，分支/跳转绘制为连线
// ============================================================

interface Edge {
  from: string
  to: string
  label: string
  kind: 'branch' | 'jump'
}

interface Node {
  id: string
  name: string
  chapter: string
}

function collectEdges(project: Project): Edge[] {
  const edges: Edge[] = []
  for (const ch of project.chapters) {
    for (const f of ch.fragments) {
      for (const b of f.blocks) {
        if (b.type === 'branch') {
          const choices = (b.props.choices as { text: string; targetFragmentId?: string }[]) ?? []
          for (const c of choices) {
            if (c.targetFragmentId) edges.push({ from: f.id, to: c.targetFragmentId, label: c.text || '选项', kind: 'branch' })
          }
        } else if (b.type === 'callFragment') {
          const target = String(b.props.target ?? '')
          if (target) edges.push({ from: f.id, to: target, label: '跳转', kind: 'jump' })
        }
      }
    }
  }
  return edges
}

export default function BranchEditor(): JSX.Element {
  const { project } = useEditor()
  const [selected, setSelected] = useState<string | null>(null)

  const { nodes, edges, layout, size } = useMemo(() => {
    const nodes: Node[] = project.chapters.flatMap((c) => c.fragments.map((f) => ({ id: f.id, name: f.name, chapter: c.name })))
    const edges = collectEdges(project)

    // BFS 分层布局
    const level = new Map<string, number>()
    const start = project.chapters[0]?.fragments[0]?.id
    if (start) level.set(start, 0)
    const queue: string[] = start ? [start] : []
    while (queue.length) {
      const id = queue.shift()!
      const cur = level.get(id)!
      for (const e of edges) {
        if (e.from === id && !level.has(e.to)) {
          level.set(e.to, cur + 1)
          queue.push(e.to)
        }
      }
    }
    // 未连接的节点归到第 0 层
    for (const n of nodes) if (!level.has(n.id)) level.set(n.id, 0)

    const byLevel = new Map<number, string[]>()
    for (const n of nodes) {
      const l = level.get(n.id) ?? 0
      if (!byLevel.has(l)) byLevel.set(l, [])
      byLevel.get(l)!.push(n.id)
    }
    const maxLevel = Math.max(...Array.from(byLevel.keys()))
    let maxCount = 1
    for (const ids of byLevel.values()) maxCount = Math.max(maxCount, ids.length)

    const layout = new Map<string, { x: number; y: number }>()
    for (const [l, ids] of byLevel) {
      ids.forEach((id, i) => {
        layout.set(id, { x: 60 + l * 280, y: 60 + i * 150 })
      })
    }
    return { nodes, edges, layout, size: { w: 60 + (maxLevel + 1) * 280, h: 60 + maxCount * 150 } }
  }, [project])

  const pos = (id: string): { x: number; y: number } => layout.get(id) ?? { x: 0, y: 0 }

  return (
    <div className="branch-editor">
      <div className="branch-hint">节点 = 片段；青色实线 = 跳转片段；橙色虚线 = 分支选项</div>
      <div className="branch-scroll">
        <div className="branch-canvas" style={{ width: size.w, height: size.h }}>
          <svg width={size.w} height={size.h} style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <marker id="arrow-jump" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8" fill="#5eb8d4" />
              </marker>
              <marker id="arrow-branch" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8" fill="#e3a64b" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const a = pos(e.from)
              const b = pos(e.to)
              const color = e.kind === 'jump' ? '#5eb8d4' : '#e3a64b'
              const dash = e.kind === 'branch' ? '6,4' : undefined
              const marker = e.kind === 'jump' ? 'url(#arrow-jump)' : 'url(#arrow-branch)'
              return (
                <g key={i}>
                  <line x1={a.x + 180} y1={a.y + 40} x2={b.x} y2={b.y + 40} stroke={color} strokeWidth={1.5} strokeDasharray={dash} markerEnd={marker} />
                  <text x={(a.x + 180 + b.x) / 2} y={(a.y + b.y) / 2 + 32} fill={color} fontSize={11} textAnchor="middle">{e.label}</text>
                </g>
              )
            })}
          </svg>
          {nodes.map((n) => {
            const p = pos(n.id)
            return (
              <div
                key={n.id}
                className={'branch-node' + (n.id === selected ? ' selected' : '')}
                style={{ left: p.x, top: p.y }}
                onClick={() => setSelected(n.id)}
              >
                <div className="branch-node-chapter">{n.chapter}</div>
                <div className="branch-node-name">{n.name}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
