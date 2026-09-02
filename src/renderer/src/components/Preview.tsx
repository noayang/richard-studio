import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react'
import { useEditor } from '../store'
import type { Block, Character } from '../model'
import { orderElementsForRender } from '../model'
import ElementRenderer from './ElementRenderer'

// ============================================================
// 实时预览：渲染游戏屏 + 从点击的块开始播放脚本
// 自适应容器尺寸，可嵌入脚本编辑器右半边或独立展示
// ============================================================

interface HistoryLine {
  id: number
  who: string
  color: string
  avatar: string
  text: string
}

export default function Preview({ embedded = false }: { embedded?: boolean }): JSX.Element {
  const { project, previewScreen, playFromBlockId, setPlayFromBlock } = useEditor()
  const screen = project.uiScreens[previewScreen] ?? Object.values(project.uiScreens)[0]

  const [bgColor, setBgColor] = useState(project.backgroundColor)
  const [sprites, setSprites] = useState<{ id: string; name: string; color: string; pos: string }[]>([])
  const [history, setHistory] = useState<HistoryLine[]>([])
  const [current, setCurrent] = useState<HistoryLine | null>(null)
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(-1)
  const lineId = useRef(0)

  // 容器测量，自适应缩放
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = (): void => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 展平所有块
  const flatBlocks: Block[] = useMemo(() => {
    return project.chapters.flatMap((c) => c.fragments.flatMap((f) => f.blocks))
  }, [project.chapters])

  const startIndex = useMemo(() => {
    if (!playFromBlockId) return -1
    return flatBlocks.findIndex((b) => b.id === playFromBlockId)
  }, [playFromBlockId, flatBlocks])

  // 点击块时从该块开始
  useEffect(() => {
    if (startIndex >= 0) {
      setIndex(startIndex)
      setPlaying(true)
      setHistory([])
      setCurrent(null)
      setSprites([])
    }
  }, [startIndex, playFromBlockId])

  const charById = useCallback(
    (id: string): Character | undefined => project.characters.find((c) => c.id === id),
    [project.characters]
  )

  // 播放引擎
  useEffect(() => {
    if (!playing || index < 0 || index >= flatBlocks.length) {
      if (playing && index >= flatBlocks.length) setPlaying(false)
      return
    }
    const block = flatBlocks[index]
    const delay = block.type === 'wait' ? Number(block.props.duration ?? 1000) : 2200

    switch (block.type) {
      case 'scene': {
        const sceneId = String(block.props.sceneId ?? '')
        const scene = project.scenes.find((s) => s.id === sceneId)
        setBgColor(scene ? '#2a2a35' : project.backgroundColor)
        break
      }
      case 'showCharacter': {
        const c = charById(String(block.props.characterId ?? ''))
        if (c) {
          setSprites((prev) => [
            ...prev.filter((s) => s.id !== c.id),
            { id: c.id, name: c.name, color: c.themeColor.ring, pos: String(block.props.position ?? c.defaultPosition) }
          ])
        }
        break
      }
      case 'removeCharacter': {
        const cid = String(block.props.characterId ?? '')
        setSprites((prev) => prev.filter((s) => s.id !== cid))
        break
      }
      case 'dialogue':
      case 'narration': {
        const cid = String(block.props.characterId ?? '')
        const c = charById(cid)
        const who = block.type === 'narration' ? '' : c?.name ?? String(block.props.characterName ?? '')
        const text = block.content?.map((x) => x.text).join('') ?? ''
        const line: HistoryLine = {
          id: ++lineId.current,
          who,
          color: c?.themeColor.fg ?? '#ffd88a',
          avatar: c?.name ?? '',
          text
        }
        setHistory((h) => [...h.slice(-50), line])
        setCurrent(line)
        break
      }
      default:
        break
    }

    const t = setTimeout(() => setIndex((i) => i + 1), delay)
    return () => clearTimeout(t)
  }, [playing, index, flatBlocks, project.scenes, project.characters, project.backgroundColor, charById])

  const replay = (): void => {
    setIndex(startIndex >= 0 ? startIndex : 0)
    setHistory([])
    setCurrent(null)
    setPlaying(true)
  }

  if (!screen) return <div className="empty-state">请先创建界面</div>

  const canvasW = screen.canvas.width
  const canvasH = screen.canvas.height
  const availW = size.w > 0 ? size.w - 24 : 800
  const availH = size.h > 0 ? size.h - 64 : 600
  const scale = Math.max(0.1, Math.min(availW / canvasW, availH / canvasH))

  return (
    <div className="preview-wrap" ref={containerRef}>
      <div className="preview-stage" style={{ width: canvasW * scale, height: canvasH * scale, background: bgColor, position: 'relative' }}>
        {/* 立绘 */}
        {sprites.map((s) => (
          <div key={s.id} className="preview-sprite" style={{ [s.pos === 'right' ? 'right' : 'left']: '6%', bottom: '0', width: '18%', height: '70%' }}>
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.3))', border: `2px solid ${s.color}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 20 }}>
              {s.name}
            </div>
          </div>
        ))}

        {/* UI 元素 */}
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})`, transformOrigin: 'top left', width: canvasW, height: canvasH }}>
          {orderElementsForRender(screen.elements).map((el) => {
            if (el.type === 'dialogue-text' || el.type === 'dialogue-name' || el.type === 'image' || el.type === 'history-list') {
              return <ElementRenderer key={el.id} el={overrideElement(el, current, history, screen)} />
            }
            return <ElementRenderer key={el.id} el={el} />
          })}
        </div>
      </div>

      <div className="preview-controls">
        <button className="btn" onClick={replay} disabled={startIndex < 0 && playFromBlockId === null}>
          ▶ 播放
        </button>
        <button className="btn" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ 暂停' : '▶ 继续'}</button>
        <button className="btn" onClick={() => setIndex((i) => i + 1)}>⏭ 下一步</button>
        {!embedded && <button className="btn" onClick={() => setPlayFromBlock(null)}>回到编辑</button>}
      </div>
    </div>
  )
}

/** 用播放状态覆盖对话框元素 */
function overrideElement(el: import('../model').UiElement, current: HistoryLine | null, history: HistoryLine[], screen: import('../model').UiScreen): import('../model').UiElement {
  if (el.type === 'dialogue-text') {
    return { ...el, props: { ...el.props, previewText: current ? current.text : String(el.props.previewText ?? '') } }
  }
  if (el.type === 'dialogue-name') {
    return { ...el, props: { ...el.props, previewName: current?.who || String(el.props.previewName ?? '') } }
  }
  if (el.type === 'image') {
    return { ...el, props: { ...el.props, src: '' } }
  }
  if (el.type === 'history-list') {
    return { ...el, props: { ...el.props, previewHistory: history, previewCurrent: current } }
  }
  return el
}
