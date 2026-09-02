import { useState } from 'react'
import { useEditor } from '../store'
import { uid } from '../model'
import type { Character, Expression, PortraitSkin } from '../model'
import AssetPickerButton from './AssetPickerButton'

// ============================================================
// 角色管理：头像（独立图片） + 立绘（表情） + 皮肤（依附于立绘）
// 三类素材都可直接打开 assets 文件夹导入图片
// ============================================================

export default function CharactersPanel(): JSX.Element {
  const { project, updateCharacter, addCharacter, removeCharacter } = useEditor()
  const [selectedId, setSelectedId] = useState<string | null>(project.characters[0]?.id ?? null)
  const char = project.characters.find((c) => c.id === selectedId) ?? null

  const addChar = (): void => {
    const c: Character = {
      id: uid('ch-'),
      name: '新角色',
      avatar: '',
      expressions: [],
      themeColor: { bg: '#dbeafe', fg: '#1e40af', ring: '#60a5fa' },
      defaultPosition: 'center'
    }
    addCharacter(c)
    setSelectedId(c.id)
  }

  return (
    <div className="split-panel">
      <div className="side-list">
        <div className="side-list-header">
          <span>角色</span>
          <button className="btn btn-sm" onClick={addChar}>+ 新增</button>
        </div>
        {project.characters.map((c) => (
          <div
            key={c.id}
            className={'side-item' + (c.id === selectedId ? ' active' : '')}
            onClick={() => setSelectedId(c.id)}
          >
            <span className="dot" style={{ background: c.themeColor.ring }} />
            {c.name}
            <span className="side-item-count">{c.expressions.length} 立绘</span>
          </div>
        ))}
      </div>

      {char ? (
        <div className="detail-panel">
          <div className="panel-title">
            <input
              className="title-input"
              value={char.name}
              onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
            />
            <button className="btn btn-sm btn-danger" onClick={() => { removeCharacter(char.id); setSelectedId(null) }}>删除</button>
          </div>

          <div className="panel-section">
            <div className="panel-group-title">头像</div>
            <div className="mini-row">
              <input
                placeholder="头像图片路径"
                value={char.avatar}
                onChange={(e) => updateCharacter(char.id, { avatar: e.target.value })}
              />
              <AssetPickerButton
                kind="image"
                label="从 assets 导入…"
                onPick={(p) => updateCharacter(char.id, { avatar: p.relativePath || p.name })}
              />
            </div>
            {char.avatar && (
              <div className="avatar-preview">
                <img src={char.avatar} alt="头像预览" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
            )}
          </div>

          <div className="panel-section">
            <div className="panel-group-title">立绘（表情）</div>
            {char.expressions.map((ex, i) => (
              <div key={ex.id} className="portrait-block">
                <ExpressionRow
                  ex={ex}
                  onChange={(patch) => {
                    const expressions = char.expressions.map((e, j) => (j === i ? { ...e, ...patch } : e))
                    updateCharacter(char.id, { expressions })
                  }}
                  onRemove={() => {
                    updateCharacter(char.id, { expressions: char.expressions.filter((_, j) => j !== i) })
                  }}
                />
                <div className="skin-group">
                  <div className="skin-group-title">皮肤（依附于「{ex.name}」）</div>
                  {ex.skins.map((sk) => (
                    <SkinRow
                      key={sk.id}
                      skin={sk}
                      onChange={(patch) => {
                        const expressions = char.expressions.map((e, j) =>
                          j === i ? { ...e, skins: e.skins.map((s) => (s.id === sk.id ? { ...s, ...patch } : s)) } : e
                        )
                        updateCharacter(char.id, { expressions })
                      }}
                      onRemove={() => {
                        const expressions = char.expressions.map((e, j) =>
                          j === i ? { ...e, skins: e.skins.filter((s) => s.id !== sk.id) } : e
                        )
                        updateCharacter(char.id, { expressions })
                      }}
                    />
                  ))}
                  <button className="btn btn-sm" onClick={() => {
                    const sk: PortraitSkin = { id: uid('sk-'), name: '新皮肤', assetPath: '' }
                    const expressions = char.expressions.map((e, j) => (j === i ? { ...e, skins: [...e.skins, sk] } : e))
                    updateCharacter(char.id, { expressions })
                  }}>+ 添加皮肤</button>
                </div>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => {
              const ex: Expression = { id: uid('ex-'), name: '新立绘', assetPath: '', skins: [] }
              updateCharacter(char.id, { expressions: [...char.expressions, ex] })
            }}>+ 添加立绘</button>
          </div>
        </div>
      ) : (
        <div className="empty-state">选择或新增一个角色</div>
      )}
    </div>
  )
}

function ExpressionRow({ ex, onChange, onRemove }: { ex: Expression; onChange: (p: Partial<Expression>) => void; onRemove: () => void }): JSX.Element {
  return (
    <div className="mini-row">
      <input placeholder="立绘名" value={ex.name} onChange={(e) => onChange({ name: e.target.value })} />
      <input placeholder="立绘图片路径" value={ex.assetPath} onChange={(e) => onChange({ assetPath: e.target.value })} />
      <AssetPickerButton kind="image" label="…" onPick={(p) => onChange({ assetPath: p.relativePath || p.name })} />
      <button className="block-del" onClick={onRemove}>✕</button>
    </div>
  )
}

function SkinRow({ skin, onChange, onRemove }: { skin: PortraitSkin; onChange: (p: Partial<PortraitSkin>) => void; onRemove: () => void }): JSX.Element {
  return (
    <div className="mini-row skin-row">
      <input placeholder="皮肤名" value={skin.name} onChange={(e) => onChange({ name: e.target.value })} />
      <input placeholder="皮肤图片路径" value={skin.assetPath} onChange={(e) => onChange({ assetPath: e.target.value })} />
      <AssetPickerButton kind="image" label="…" onPick={(p) => onChange({ assetPath: p.relativePath || p.name })} />
      <button className="block-del" onClick={onRemove}>✕</button>
    </div>
  )
}
