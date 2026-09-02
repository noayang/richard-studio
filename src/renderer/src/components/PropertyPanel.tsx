import { useEditor } from '../store'
import type { UiStyle } from '../model'
import AssetPickerButton from './AssetPickerButton'
import VariableInserter from './VariableInserter'

// ============================================================
// 属性面板：编辑选中元素的位置/样式/属性
// ============================================================

export default function PropertyPanel(): JSX.Element {
  const { project, selectedScreen, selectedElementId, updateElement, ungroupElements } = useEditor()
  const screen = project.uiScreens[selectedScreen]
  const el = screen?.elements.find((e) => e.id === selectedElementId)

  if (!el) {
    return (
      <div className="panel">
        <div className="panel-title">属性</div>
        <div className="panel-empty">未选中元素</div>
      </div>
    )
  }

  const patchStyle = (k: keyof UiStyle, v: unknown): void => {
    updateElement(selectedScreen, el.id, { style: { ...el.style, [k]: v } })
  }
  const patchRect = (k: 'x' | 'y' | 'w' | 'h', v: number): void => {
    updateElement(selectedScreen, el.id, { rect: { ...el.rect, [k]: v } })
  }
  const patchProp = (k: string, v: unknown): void => {
    updateElement(selectedScreen, el.id, { props: { ...el.props, [k]: v } })
  }

  const num = (v: unknown): string => (typeof v === 'number' ? String(v) : '')

  return (
    <div className="panel">
      <div className="panel-title">属性</div>
      <div className="panel-section">
        <div className="panel-label">{el.type}</div>
        <Field label="名称">
          <input value={el.name} onChange={(e) => updateElement(selectedScreen, el.id, { name: e.target.value })} />
        </Field>
      </div>

      {el.groupId && (
        <div className="panel-section">
          <div className="panel-group-title">编组</div>
          <div className="group-info">
            <span className="group-badge">🔒 已编组</span>
            <button className="btn btn-sm" onClick={() => ungroupElements(selectedScreen, [el.id])}>解除编组</button>
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-group-title">位置与尺寸</div>
        <div className="grid-2">
          <Field label="X"><input type="number" value={num(el.rect.x)} onChange={(e) => patchRect('x', +e.target.value)} /></Field>
          <Field label="Y"><input type="number" value={num(el.rect.y)} onChange={(e) => patchRect('y', +e.target.value)} /></Field>
          <Field label="宽"><input type="number" value={num(el.rect.w)} onChange={(e) => patchRect('w', +e.target.value)} /></Field>
          <Field label="高"><input type="number" value={num(el.rect.h)} onChange={(e) => patchRect('h', +e.target.value)} /></Field>
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-group-title">样式</div>
        <Field label="透明度">
          <input type="number" min={0} max={100} value={num(el.style.opacity ?? 100)} onChange={(e) => patchStyle('opacity', +e.target.value)} />
        </Field>
        {el.style.color !== undefined && (
          <ColorField label="文字颜色" value={String(el.style.color)} onChange={(v) => patchStyle('color', v)} />
        )}
        {(el.style.fill !== undefined && el.style.fill !== 'transparent') && (
          <ColorField label="填充色" value={String(el.style.fill)} onChange={(v) => patchStyle('fill', v)} />
        )}
        {(el.style.fill !== undefined || el.type === 'button' || el.type === 'rect') && (
          <Field label="填充图片">
            <div className="fill-image-row">
              <input
                placeholder="图片 URL / 相对路径，留空则用填充色"
                value={String(el.style.fillImage ?? '')}
                onChange={(e) => patchStyle('fillImage', e.target.value)}
              />
              <AssetPickerButton
                kind="image"
                label="选择图片…"
                onPick={(p) => patchStyle('fillImage', p.dataUrl ?? p.relativePath ?? p.path)}
              />
            </div>
          </Field>
        )}
        {el.style.fontSize !== undefined && (
          <Field label="字号">
            <input type="number" value={num(el.style.fontSize)} onChange={(e) => patchStyle('fontSize', +e.target.value)} />
          </Field>
        )}
        {el.style.radius !== undefined && (
          <Field label="圆角">
            <input type="number" value={num(el.style.radius)} onChange={(e) => patchStyle('radius', +e.target.value)} />
          </Field>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-group-title">内容</div>
        {('text' in el.props || el.type === 'text' || el.type === 'paragraph') && (
          <Field label="文本">
            <textarea rows={3} value={String(el.props.text ?? '')} onChange={(e) => patchProp('text', e.target.value)} />
          </Field>
        )}
        {el.type === 'dialogue-text' && (
          <Field label="预览对白">
            <textarea rows={4} value={String(el.props.previewText ?? '')} onChange={(e) => patchProp('previewText', e.target.value)} />
          </Field>
        )}
        {el.type === 'dialogue-name' && (
          <Field label="预览角色名">
            <input value={String(el.props.previewName ?? '')} onChange={(e) => patchProp('previewName', e.target.value)} />
          </Field>
        )}
        {el.type === 'image' && (
          <Field label="图片 URL / dataURL">
            <div className="fill-image-row">
              <input value={String(el.props.src ?? '')} onChange={(e) => patchProp('src', e.target.value)} />
              <AssetPickerButton
                kind="image"
                label="选择图片…"
                onPick={(p) => patchProp('src', p.dataUrl ?? p.relativePath ?? p.path)}
              />
            </div>
          </Field>
        )}
        {el.type === 'button' && (
          <Field label="按钮文字">
            <input value={String(el.props.text ?? '')} onChange={(e) => patchProp('text', e.target.value)} />
          </Field>
        )}
        {(el.type === 'text' || el.type === 'paragraph' || el.type === 'button' || el.type === 'message-box') && (
          <Field label="插入变量">
            <VariableInserter onInsert={(t) => patchProp('text', String(el.props.text ?? '') + t)} />
          </Field>
        )}
        {el.type === 'variable-panel' && (
          <div className="grid-2">
            <Field label="显示全局变量">
              <input type="checkbox" checked={el.props.showGlobal !== false} onChange={(e) => patchProp('showGlobal', e.target.checked)} />
            </Field>
            <Field label="显示局部变量">
              <input type="checkbox" checked={el.props.showLocal !== false} onChange={(e) => patchProp('showLocal', e.target.checked)} />
            </Field>
          </div>
        )}
        {el.type === 'variable-value' && (
          <Field label="变量（仅显示其值）">
            <select value={String(el.props.variableId ?? '')} onChange={(e) => patchProp('variableId', e.target.value)}>
              <option value="">（选择变量）</option>
              {project.variables.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </Field>
        )}
        {el.type === 'shop-list' && (
          <Field label="列表内容">
            <select value={String(el.props.source ?? 'shop')} onChange={(e) => patchProp('source', e.target.value)}>
              <option value="shop">商店商品（买入）</option>
              <option value="inventory">背包（卖出）</option>
            </select>
          </Field>
        )}
      </div>

    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="color-field">
        <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

function toHex(c: string): string {
  if (c.startsWith('#')) return c
  if (c.startsWith('rgba') || c.startsWith('rgb')) {
    const m = c.match(/\d+/g)
    if (m && m.length >= 3) {
      return '#' + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('')
    }
  }
  return '#ffffff'
}
