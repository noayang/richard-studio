import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditor } from '../store'
import { ELEMENT_CATALOG, createElement, orderElementsForRender } from '../model'
import type { UiElement, ElementType, Rect } from '../model'
import ElementRenderer from './ElementRenderer'
import AssetPickerButton from './AssetPickerButton'

// ============================================================
// 画布编辑器：拖拽移动、缩放、右键插入元素、多选编组一起移动
// ============================================================

interface DragMember {
  id: string
  orig: Rect
}

interface DragState {
  kind: 'move' | 'resize'
  members: DragMember[]
  startX: number
  startY: number
  handle?: string
}

const HANDLES = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']

export default function Canvas(): JSX.Element {
  const { project, selectedScreen, selectedElementId, setSelectedElement, updateElement, addElement, removeElement, updateScreen } = useEditor()
  const screen = project.uiScreens[selectedScreen]
  const [scale, setScale] = useState(0.5)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)

  const fitScale = useCallback(() => {
    const c = containerRef.current
    if (!c || !screen) return
    const availW = c.clientWidth - 32
    const availH = c.clientHeight - 32
    setScale(Math.min(availW / screen.canvas.width, availH / screen.canvas.height))
  }, [screen])

  useEffect(() => {
    fitScale()
    const onResize = (): void => fitScale()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitScale])

  if (!screen) {
    return <div className="empty-state">请选择一个界面</div>
  }

  const canvasW = screen.canvas.width
  const canvasH = screen.canvas.height

  const onMouseDown = (e: React.MouseEvent, el: UiElement, kind: 'move' | 'resize', handle?: string): void => {
    e.stopPropagation()
    setSelectedElement(el.id)
    if (e.ctrlKey || e.metaKey) {
      setSelection((prev) => (prev.includes(el.id) ? prev.filter((x) => x !== el.id) : [...prev, el.id]))
    } else {
      setSelection([el.id])
    }
    const members = el.groupId ? screen.elements.filter((x) => x.groupId === el.groupId) : [el]
    dragRef.current = {
      kind,
      members: members.map((m) => ({ id: m.id, orig: { ...m.rect } })),
      startX: e.clientX,
      startY: e.clientY,
      handle
    }
  }

  const onMouseMove = (e: React.MouseEvent): void => {
    const drag = dragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startX) / scale
    const dy = (e.clientY - drag.startY) / scale
    if (drag.kind === 'move') {
      for (const m of drag.members) {
        const r = m.orig
        updateElement(selectedScreen, m.id, { rect: { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h } })
      }
    } else {
      const m = drag.members[0]
      const r = m.orig
      let rect = { ...r }
      const h = drag.handle!
      if (h.includes('e')) rect.w = r.w + dx
      if (h.includes('s')) rect.h = r.h + dy
      if (h.includes('w')) {
        rect.x = r.x + dx
        rect.w = r.w - dx
      }
      if (h.includes('n')) {
        rect.y = r.y + dy
        rect.h = r.h - dy
      }
      if (rect.w < 4) rect.w = 4
      if (rect.h < 4) rect.h = 4
      updateElement(selectedScreen, m.id, { rect })
    }
  }

  const onMouseUp = (): void => {
    dragRef.current = null
  }

  const onContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const insertElement = (type: ElementType): void => {
    const el = createElement(type)
    el.rect.x = Math.round((canvasW - el.rect.w) / 2)
    el.rect.y = Math.round((canvasH - el.rect.h) / 2)
    addElement(selectedScreen, el)
    setSelectedElement(el.id)
    setSelection([el.id])
    setMenu(null)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.key === 'Delete' || e.key === 'Backspace')) {
      deleteSelected()
    }
  }

  const selectedSet = new Set(selection.length > 0 ? selection : selectedElementId ? [selectedElementId] : [])

  const deleteSelected = (): void => {
    const ids = selection.length > 0 ? selection : selectedElementId ? [selectedElementId] : []
    for (const id of ids) removeElement(selectedScreen, id)
    setSelectedElement(null)
    setSelection([])
    setMenu(null)
  }

  return (
    <div className="canvas-wrap" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onContextMenu={onContextMenu} onKeyDown={onKeyDown} tabIndex={0}>
      <div className="canvas-scroll" ref={containerRef}>
        <div
          className="canvas"
          style={{ width: canvasW * scale, height: canvasH * scale, background: project.backgroundColor }}
        >
          {screen.backgroundImage && (
            <img
              className="canvas-background"
              src={screen.backgroundImage}
              alt=""
              draggable={false}
              style={{ width: canvasW * scale, height: canvasH * scale }}
            />
          )}
          {orderElementsForRender(screen.elements).map((el) => (
            <CanvasElement
              key={el.id}
              el={el}
              scale={scale}
              selected={selectedSet.has(el.id)}
              grouped={!!el.groupId}
              outOfBounds={isOutOfBounds(el, canvasW, canvasH)}
              onMouseDown={onMouseDown}
              onSelect={() => setSelectedElement(el.id)}
            />
          ))}
        </div>
      </div>

      <div className="canvas-toolbar">
        <span className="canvas-title">{screen.name}</span>
        <span className="canvas-hint">虚线框 = 玩家可见窗口 · 尺寸 {canvasW}×{canvasH} · Ctrl+多选 · 右键插入 · Del 删除</span>
        {screen.elements.some((el) => isOutOfBounds(el, canvasW, canvasH)) && (
          <span className="canvas-hint oob-warn">
            ⚠ {screen.elements.filter((el) => isOutOfBounds(el, canvasW, canvasH)).length} 个控件超出画面
          </span>
        )}
        <span className="canvas-hint">背景图</span>
        <AssetPickerButton
          kind="image"
          label={screen.backgroundImage ? '更换背景…' : '选择背景图…'}
          onPick={(p) => updateScreen(selectedScreen, { backgroundImage: p.dataUrl ?? p.relativePath ?? p.path })}
        />
        {screen.backgroundImage && (
          <button className="btn btn-sm" onClick={() => updateScreen(selectedScreen, { backgroundImage: undefined })}>清除背景</button>
        )}
        <button className="btn btn-sm btn-danger" disabled={selectedSet.size === 0} onClick={deleteSelected}>删除所选</button>
      </div>

      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <div className="context-menu-title">插入元素</div>
          {selectedSet.size > 0 && (
            <div className="context-menu-item" onClick={deleteSelected}>🗑 删除所选元素</div>
          )}
          {groupCatalog().map((group) => (
            <div key={group.category}>
              <div className="context-menu-group">{group.category}</div>
              {group.items.map((d) => (
                <div key={d.type} className="context-menu-item" onClick={() => insertElement(d.type)}>
                  {d.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function groupCatalog(): { category: string; items: typeof ELEMENT_CATALOG }[] {
  const map = new Map<string, typeof ELEMENT_CATALOG>()
  for (const d of ELEMENT_CATALOG) {
    if (!map.has(d.category)) map.set(d.category, [])
    map.get(d.category)!.push(d)
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
}

function CanvasElement({
  el,
  scale,
  selected,
  grouped,
  outOfBounds,
  onMouseDown,
  onSelect
}: {
  el: UiElement
  scale: number
  selected: boolean
  grouped: boolean
  outOfBounds: boolean
  onMouseDown: (e: React.MouseEvent, el: UiElement, kind: 'move' | 'resize', handle?: string) => void
  onSelect: () => void
}): JSX.Element {
  return (
    <div
      className={'canvas-element' + (selected ? ' selected' : '') + (grouped ? ' grouped' : '') + (outOfBounds ? ' out-of-bounds' : '')}
      style={{
        left: el.rect.x * scale,
        top: el.rect.y * scale,
        width: el.rect.w * scale,
        height: el.rect.h * scale,
        transform: anchorTransform(el.anchor)
      }}
      onMouseDown={(e) => onMouseDown(e, el, 'move')}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <div className="el-info">
        {Math.round(el.rect.x)},{Math.round(el.rect.y)} · {Math.round(el.rect.w)}×{Math.round(el.rect.h)}
        {outOfBounds && ' ⚠超出画面'}
      </div>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: el.rect.w, height: el.rect.h }}>
        <ElementRenderer el={el} local />
      </div>
      {selected && (
        <>
          {HANDLES.map((h) => (
            <div key={h} className={`handle handle-${h}`} onMouseDown={(e) => onMouseDown(e, el, 'resize', h)} />
          ))}
        </>
      )}
    </div>
  )
}

// 判断元素是否部分超出游戏窗口（玩家可见区域）范围
function isOutOfBounds(el: UiElement, cw: number, ch: number): boolean {
  return el.rect.x < 0 || el.rect.y < 0 || el.rect.x + el.rect.w > cw || el.rect.y + el.rect.h > ch
}

function anchorTransform(anchor: string): string {
  const m: Record<string, string> = {
    tl: 'none',
    tc: 'translateX(-50%)',
    tr: 'translateX(-100%)',
    cl: 'translateY(-50%)',
    c: 'translate(-50%,-50%)',
    cr: 'translate(-100%,-50%)',
    bl: 'translateY(-100%)',
    bc: 'translate(-50%,-100%)',
    br: 'translate(-100%,-100%)'
  }
  return m[anchor] ?? 'none'
}
