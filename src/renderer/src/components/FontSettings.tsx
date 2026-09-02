import { useEditor } from '../store'
import AssetPickerButton from './AssetPickerButton'

// ============================================================
// 全局字体设置：两套可替换字体
//   · UI 字体：按钮文字 / 角色名 / 标题等界面文字
//   · 对话字体：对话框里的对白文本
// 支持从本地字体文件（.ttf/.otf）选择并即时注册为 @font-face
// ============================================================

/** 把字体文件的 data URL 注册为 @font-face，返回可用的 font-family 名 */
function registerFont(filename: string, dataUrl: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '_') || 'CustomFont'
  const family = `RS_${base}`
  const styleId = `rs-font-${family}`
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `@font-face { font-family: '${family}'; src: url(${dataUrl}) format('truetype'); }`
    document.head.appendChild(style)
  }
  return `'${family}', sans-serif`
}

const FONT_OPTIONS = [
  { label: '系统默认', value: "'PingFang SC','Microsoft YaHei',sans-serif" },
  { label: '苹方', value: "'PingFang SC',sans-serif" },
  { label: '微软雅黑', value: "'Microsoft YaHei',sans-serif" },
  { label: '黑体', value: "'SimHei','Microsoft YaHei',sans-serif" },
  { label: '宋体', value: "'SimSun',serif" },
  { label: '楷体', value: "'KaiTi',serif" },
  { label: '思源黑体', value: "'Source Han Sans SC','Noto Sans SC',sans-serif" },
  { label: '思源宋体', value: "'Source Han Serif SC','Noto Serif SC',serif" },
  { label: '衬线体', value: 'Georgia,serif' },
  { label: '等宽体', value: "'Courier New',monospace" }
]

export default function FontSettings({ onClose }: { onClose: () => void }): JSX.Element {
  const { project, updateThemeFonts } = useEditor()
  const t = project.themeFonts

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">全局字体替换</div>

        <FontSlot
          title="UI 字体（按钮文字 / 角色名 / 标题）"
          value={t.uiFontFamily}
          onChange={(v) => updateThemeFonts({ uiFontFamily: v })}
        />
        <FontSlot
          title="对话字体（对话框对白文本）"
          value={t.dialogueFontFamily}
          onChange={(v) => updateThemeFonts({ dialogueFontFamily: v })}
        />

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  )
}

function FontSlot({ title, value, onChange }: { title: string; value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <div className="panel-section">
      <div className="field-label">{title}</div>
      <div className="mini-row">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {FONT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="fill-image-row">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="自定义字体族，如 'MyFont',sans-serif"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: 6, fontSize: 13 }}
        />
        <AssetPickerButton
          kind="font"
          label="选择字体文件…"
          onPick={(p) => {
            if (p.dataUrl) onChange(registerFont(p.name, p.dataUrl))
          }}
        />
      </div>
      <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 20, fontFamily: value }}>
        预览：字体效果 Aa 中文
      </div>
    </div>
  )
}
