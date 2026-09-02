import { useState } from 'react'
import { useEditor } from '../store'
import { uid } from '../model'
import type { Achievement } from '../model'
import AssetPickerButton from './AssetPickerButton'

// ============================================================
// 成就管理：定义成就（名称/说明/图标/触发变量/是否隐藏）
// 触发变量：脚本中 $ 变量 = True 时自动解锁成就
// ============================================================

export default function AchievementsPanel(): JSX.Element {
  const { project, addAchievement, updateAchievement, removeAchievement } = useEditor()
  const [selectedId, setSelectedId] = useState<string | null>(project.achievements[0]?.id ?? null)
  const ach = project.achievements.find((a) => a.id === selectedId) ?? null

  const add = (): void => {
    const a: Achievement = { id: uid('ac-'), name: '新成就', description: '', icon: '', hidden: false, variable: 'ach_new' }
    addAchievement(a)
    setSelectedId(a.id)
  }

  return (
    <div className="split-panel">
      <div className="side-list">
        <div className="side-list-header">
          <span>成就</span>
          <button className="btn btn-sm" onClick={add}>+ 新增</button>
        </div>
        {project.achievements.map((a) => (
          <div key={a.id} className={'side-item' + (a.id === selectedId ? ' active' : '')} onClick={() => setSelectedId(a.id)}>
            <span className="dot" style={{ background: a.hidden ? '#888' : '#ffd88a' }} />
            {a.name}
          </div>
        ))}
      </div>

      {ach ? (
        <div className="detail-panel">
          <div className="panel-title">
            <input className="title-input" value={ach.name} onChange={(e) => updateAchievement(ach.id, { name: e.target.value })} />
            <button className="btn btn-sm btn-danger" onClick={() => { removeAchievement(ach.id); setSelectedId(null) }}>删除</button>
          </div>

          <div className="panel-section">
            <div className="field">
              <div className="field-label">说明</div>
              <textarea rows={3} value={ach.description} onChange={(e) => updateAchievement(ach.id, { description: e.target.value })} />
            </div>
            <div className="field">
              <div className="field-label">图标（图片 URL / dataURL）</div>
              <div className="fill-image-row">
                <input value={ach.icon} onChange={(e) => updateAchievement(ach.id, { icon: e.target.value })} />
                <AssetPickerButton
                  kind="image"
                  label="选择图片…"
                  onPick={(p) => updateAchievement(ach.id, { icon: p.dataUrl ?? p.relativePath ?? p.path })}
                />
              </div>
            </div>
            {ach.icon && <img src={ach.icon} className="modal-preview" alt="" />}
            <div className="field">
              <div className="field-label">触发变量（玩家不可见）</div>
              <input value={ach.variable} onChange={(e) => updateAchievement(ach.id, { variable: e.target.value })} placeholder="例如 ach_first_meeting" />
              <div className="field-label" style={{ color: '#999' }}>脚本中执行 $ {ach.variable || '变量'} = True 时自动解锁此成就。</div>
            </div>
            <div className="field">
              <div className="field-label">隐藏</div>
              <input type="checkbox" checked={ach.hidden} onChange={(e) => updateAchievement(ach.id, { hidden: e.target.checked })} />
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">选择或新增一个成就</div>
      )}
    </div>
  )
}
