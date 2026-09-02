import { useState } from 'react'
import { useEditor } from '../store'
import { uid } from '../model'
import type { DictionaryEntry } from '../model'
import AssetPickerButton from './AssetPickerButton'

// ============================================================
// 辞典编辑器：专有名词 → 图片 + 文字解释
// 在对话文本里写 [[词条名]] 即可生成可点击超链接，弹窗解释
// ============================================================

export default function DictionaryPanel(): JSX.Element {
  const { project, addDictionaryEntry, updateDictionaryEntry, removeDictionaryEntry } = useEditor()
  const [selectedId, setSelectedId] = useState<string | null>(project.dictionary[0]?.id ?? null)
  const entry = project.dictionary.find((d) => d.id === selectedId) ?? null

  const add = (): void => {
    const d: DictionaryEntry = { id: uid('dic-'), term: '新词条', aliases: '', image: '', text: '' }
    addDictionaryEntry(d)
    setSelectedId(d.id)
  }

  return (
    <div className="split-panel">
      <div className="side-list">
        <div className="side-list-header">
          <span>辞典词条</span>
          <button className="btn btn-sm" onClick={add}>+ 新增</button>
        </div>
        {project.dictionary.map((d) => (
          <div key={d.id} className={'side-item' + (d.id === selectedId ? ' active' : '')} onClick={() => setSelectedId(d.id)}>
            <span>📖</span>
            {d.term}
          </div>
        ))}
      </div>

      {entry ? (
        <div className="detail-panel">
          <div className="panel-title">
            <input className="title-input" value={entry.term} onChange={(e) => updateDictionaryEntry(entry.id, { term: e.target.value })} />
            <button className="btn btn-sm btn-danger" onClick={() => { removeDictionaryEntry(entry.id); setSelectedId(null) }}>删除</button>
          </div>

          <div className="panel-section">
            <div className="field">
              <div className="field-label">别名（逗号分隔，可同样触发超链接）</div>
              <input value={entry.aliases} onChange={(e) => updateDictionaryEntry(entry.id, { aliases: e.target.value })} />
            </div>
            <div className="field">
              <div className="field-label">配图（图片 URL / dataURL）</div>
              <div className="fill-image-row">
                <input value={entry.image} onChange={(e) => updateDictionaryEntry(entry.id, { image: e.target.value })} />
                <AssetPickerButton
                  kind="image"
                  label="选择图片…"
                  onPick={(p) => updateDictionaryEntry(entry.id, { image: p.dataUrl ?? p.relativePath ?? p.path })}
                />
              </div>
            </div>
            {entry.image && <img src={entry.image} className="modal-preview" alt="" />}
            <div className="field">
              <div className="field-label">文字解释</div>
              <textarea rows={6} value={entry.text} onChange={(e) => updateDictionaryEntry(entry.id, { text: e.target.value })} />
            </div>
            <div className="field-label" style={{ color: '#999' }}>
              在「脚本」页的对话块里写 [[{entry.term}]] 即可生成超链接。
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">选择或新增一个词条</div>
      )}
    </div>
  )
}
