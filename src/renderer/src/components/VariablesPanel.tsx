import { useState } from 'react'
import { useEditor } from '../store'
import { uid } from '../model'
import type { GameVariable, VariableScope, VariableType } from '../model'

// ============================================================
// 变量编辑器：管理游戏内所有全局 / 局部变量
//   可新建、删除、重命名、设定类型与默认值（赋值）
//   变量会显示在「变量显示」界面的变量面板上
// ============================================================

export default function VariablesPanel(): JSX.Element {
  const { project, addVariable, updateVariable, removeVariable } = useEditor()
  const [selectedId, setSelectedId] = useState<string | null>(project.variables[0]?.id ?? null)
  const v = project.variables.find((x) => x.id === selectedId) ?? null

  const add = (): void => {
    const nv: GameVariable = { id: uid('var-'), name: '新变量', varName: 'new_var', value: '0', type: 'number', scope: 'global' }
    addVariable(nv)
    setSelectedId(nv.id)
  }

  const globalCount = project.variables.filter((x) => x.scope === 'global').length
  const localCount = project.variables.filter((x) => x.scope === 'local').length

  return (
    <div className="split-panel">
      <div className="side-list">
        <div className="side-list-header">
          <span>变量</span>
          <button className="btn btn-sm" onClick={add}>+ 新增</button>
        </div>
        <div className="side-list-sub">全局 {globalCount} · 局部 {localCount}</div>
        {project.variables.map((x) => (
          <div key={x.id} className={'side-item' + (x.id === selectedId ? ' active' : '')} onClick={() => setSelectedId(x.id)}>
            <span className="dot" style={{ background: x.scope === 'global' ? '#7fd4c8' : '#e3a64b' }} />
            <span className="side-item-name">{x.name}</span>
            <span className="side-item-meta">{previewValue(x)}</span>
            <button
              className="block-del"
              title="删除变量"
              onClick={(e) => {
                e.stopPropagation()
                removeVariable(x.id)
                if (selectedId === x.id) setSelectedId(null)
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {v ? (
        <div className="detail-panel">
          <div className="panel-title">
            <input className="title-input" value={v.name} onChange={(e) => updateVariable(v.id, { name: e.target.value })} />
            <button className="btn btn-sm btn-danger" onClick={() => { removeVariable(v.id); setSelectedId(null) }}>删除</button>
          </div>

          <div className="panel-section">
            <div className="field">
              <div className="field-label">变量名（Ren'Py 标识符）</div>
              <input value={v.varName} onChange={(e) => updateVariable(v.id, { varName: e.target.value })} placeholder="例如 money" />
            </div>
            <div className="field">
              <div className="field-label">类型</div>
              <select value={v.type} onChange={(e) => updateVariable(v.id, { type: e.target.value as VariableType })}>
                <option value="number">数字</option>
                <option value="string">字符串</option>
                <option value="boolean">布尔</option>
              </select>
            </div>
            <div className="field">
              <div className="field-label">作用域</div>
              <select value={v.scope} onChange={(e) => updateVariable(v.id, { scope: e.target.value as VariableScope })}>
                <option value="global">全局变量</option>
                <option value="local">局部变量</option>
              </select>
            </div>
            <div className="field">
              <div className="field-label">默认值 / 赋值</div>
              <VariableValueInput v={v} onChange={(value) => updateVariable(v.id, { value })} />
            </div>
            <div className="field-label" style={{ color: '#999' }}>导出为：default {v.varName || 'var'} = {exportPreview(v)}</div>
          </div>
        </div>
      ) : (
        <div className="empty-state">选择或新增一个变量</div>
      )}
    </div>
  )
}

function VariableValueInput({ v, onChange }: { v: GameVariable; onChange: (value: string) => void }): JSX.Element {
  if (v.type === 'boolean') {
    const truthy = v.value === 'true' || v.value === 'True' || v.value === '1'
    return (
      <select value={truthy ? 'true' : 'false'} onChange={(e) => onChange(e.target.value)}>
        <option value="true">是（True）</option>
        <option value="false">否（False）</option>
      </select>
    )
  }
  if (v.type === 'number') {
    return <input type="number" value={v.value} onChange={(e) => onChange(e.target.value)} placeholder="0" />
  }
  return <input value={v.value} onChange={(e) => onChange(e.target.value)} placeholder="文本值" />
}

function previewValue(v: GameVariable): string {
  if (v.type === 'boolean') return v.value === 'true' || v.value === 'True' || v.value === '1' ? '是' : '否'
  return v.value || '—'
}

function exportPreview(v: GameVariable): string {
  if (v.type === 'string') return `"${v.value}"`
  if (v.type === 'boolean') return v.value === 'true' || v.value === 'True' || v.value === '1' ? 'True' : 'False'
  const n = Number(v.value)
  return Number.isFinite(n) && v.value !== '' ? String(n) : (v.value || '0')
}
