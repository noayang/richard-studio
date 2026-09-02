import { useState } from 'react'
import { useEditor } from '../store'

// ============================================================
// 变量插入器：从变量列表选择变量，插入 [varName]
//   显示变量就是显示变量的值，所以只需一个「插入变量」按钮，
//   插入 Ren'Py 文本插值 [varName]，运行时显示该变量的实时数值。
// ============================================================

export default function VariableInserter({ onInsert }: { onInsert: (text: string) => void }): JSX.Element {
  const { project } = useEditor()
  const [selectedId, setSelectedId] = useState<string>(project.variables[0]?.id ?? '')
  const selected = project.variables.find((v) => v.id === selectedId) ?? project.variables[0]

  if (!selected) return <div className="bi-hint">变量列表为空（在「变量」页添加）</div>

  const varName = selected.varName || selected.name

  return (
    <div className="bi-term-insert">
      <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
        {project.variables.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>
      <button className="btn btn-sm" onClick={() => onInsert(`[${varName}]`)}>插入变量</button>
    </div>
  )
}
