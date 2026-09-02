import type { CSSProperties } from 'react'
import type { UiElement } from '../model'
import { useEditor } from '../store'
import RichText from './RichText'

// ============================================================
// 把 UiElement 渲染成可视化 DOM，供画布编辑器和预览窗口共用
// ============================================================

function toCss(el: UiElement, fontFamily?: string): CSSProperties {
  const s = el.style
  const css: CSSProperties = {
    position: 'absolute',
    left: el.rect.x,
    top: el.rect.y,
    width: el.rect.w,
    height: el.rect.h,
    opacity: (s.opacity ?? 100) / 100,
    color: s.color,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    fontFamily: fontFamily ?? s.fontFamily,
    letterSpacing: s.letterSpacing,
    lineHeight: s.lineHeight,
    textAlign: s.textAlign,
    background: s.fill && s.fill !== 'transparent' ? s.fill : undefined,
    borderColor: s.borderColor && s.borderColor !== 'transparent' ? s.borderColor : undefined,
    borderWidth: s.borderWidth ? `${s.borderWidth}px` : undefined,
    borderStyle: s.borderWidth ? 'solid' : undefined,
    borderRadius: s.radius,
    boxSizing: 'border-box',
    overflow: 'hidden'
  }
  if (s.fillImage) {
    css.backgroundImage = `url(${s.fillImage})`
    css.backgroundSize = 'cover'
    css.backgroundPosition = 'center'
  }
  if (s.backdropBlur) css.backdropFilter = `blur(${s.backdropBlur}px)`
  // 文本类元素：内容在其 rect 内水平 + 垂直居中（文字坐标落在 rect 中心，rect 覆盖整条文字）
  if (CENTERED_TEXT_TYPES.has(el.type)) {
    css.display = 'flex'
    css.flexDirection = 'column'
    css.justifyContent = 'center'
    css.textAlign = 'center'
  }
  return css
}

const ANCHOR_TRANSFORM: Record<string, string> = {
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

// 属于「界面文字」（按钮 / 角色名 / 标题）的元素 → 用全局 UI 字体
const UI_FONT_TYPES = new Set(['text', 'paragraph', 'button', 'dialogue-name', 'choice-text', 'choice-list', 'message-box'])

// 文本标签类元素：内容在 rect 内水平 + 垂直居中
const CENTERED_TEXT_TYPES = new Set(['text', 'paragraph', 'dialogue-name', 'choice-text', 'variable-value'])

export default function ElementRenderer({ el, local = false }: { el: UiElement; local?: boolean }): JSX.Element {
  const { project } = useEditor()
  const font =
    el.type === 'dialogue-text'
      ? project.themeFonts.dialogueFontFamily
      : UI_FONT_TYPES.has(el.type)
        ? project.themeFonts.uiFontFamily
        : undefined
  const css = toCss(el, font || el.style.fontFamily)
  if (local) {
    // 画布模式：外层 .canvas-element 已经按 rect 定位 + 缩放 + 锚点，
    // 这里内容就地填满 wrapper，不再重复套用 left/top/anchor，
    // 否则填充色 / 文字 / 图片会相对选中框产生偏移（叠不在一起）。
    css.left = 0
    css.top = 0
    css.transform = 'none'
  } else {
    // 预览模式：放在整张画布容器里，用 rect.x/y 绝对定位 + 锚点。
    css.transform = ANCHOR_TRANSFORM[el.anchor] ?? 'none'
  }

  const content = renderContent(el)

  return (
    <div style={css} data-type={el.type}>
      {content}
    </div>
  )
}

function renderContent(el: UiElement): JSX.Element | null {
  const p = el.props
  switch (el.type) {
    case 'text':
    case 'paragraph':
      return <RichText text={String(p.text ?? '')} />
    case 'dialogue-text':
      return <RichText text={String(p.previewText ?? '')} />
    case 'dialogue-name':
      return <span>{String(p.previewName ?? '')}</span>
    case 'dialogue-wait-cursor':
      return <span style={{ display: 'block', textAlign: 'center', lineHeight: `${el.rect.h}px` }}>▼</span>
    case 'button':
      return <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{String(p.text ?? '')}</span>
    case 'image':
      return p.src ? (
        <img src={String(p.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: p.shape === 'circle' ? '50%' : 0 }} alt="" />
      ) : (
        <div className="el-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#666' }}>图片</div>
      )
    case 'slider':
      return (
        <div style={{ padding: '6px 12px' }}>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
            <div style={{ width: '50%', height: 4, background: el.style.color ?? '#7fd4c8', borderRadius: 2 }} />
          </div>
        </div>
      )
    case 'switch':
      return (
        <div style={{ padding: 6 }}>
          <div style={{ width: 32, height: 20, borderRadius: 10, background: p.value ? '#7fd4c8' : 'rgba(255,255,255,0.2)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 2, left: p.value ? 14 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
          </div>
        </div>
      )
    case 'tabs':
      return (
        <div style={{ display: 'flex', gap: 6, padding: 6 }}>
          {(Array.isArray(p.tabs) ? (p.tabs as string[]) : ['标签一', '标签二']).map((t, i) => (
            <div key={i} style={{ padding: '6px 14px', borderRadius: 6, background: i === 0 ? 'rgba(255,255,255,0.12)' : 'transparent', color: i === 0 ? el.style.color : undefined }}>{t}</div>
          ))}
        </div>
      )
    case 'select':
      return <div style={{ padding: 8, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>▾ {String(p.label ?? '选项')}</div>
    case 'history-list': {
      const historyLines: { who: string; text: string }[] =
        Array.isArray(p.previewHistory) && (p.previewHistory as unknown[]).length > 0
          ? (p.previewHistory as { who: string; text: string }[])
          : Array.from({ length: 4 }).map(() => ({ who: '角色名', text: '这是一段可以滚动的对话历史…' }))
      const currentLine: { who: string; text: string } | null = p.showCurrent
        ? (() => {
            const c = p.previewCurrent as { who?: string; text?: string } | undefined
            return {
              who: c ? String(c.who ?? '') : String(p.previewWho ?? ''),
              text: c ? String(c.text ?? '') : String(p.previewText ?? '')
            }
          })()
        : null
      const avatarSize = Number(p.avatarSize ?? 96)
      const nameColor = String(p.nameColor ?? '#ffd88a')
      const nameSize = Number(p.nameSize ?? 30)
      const lineSize = el.style.fontSize ? el.style.fontSize - 4 : 18
      // 头像 + 角色名放在对话框外侧（左侧列），对白文本放在右侧，随历史一起滚动
      const renderBubble = (line: { who: string; text: string }, isCurrent: boolean, key: string): JSX.Element => (
        <div key={key} style={{ display: 'flex', gap: 24, alignItems: 'flex-start', opacity: isCurrent ? 1 : 0.72 }}>
          {line.who ? (
            <div style={{ width: avatarSize, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              {Boolean(p.showAvatar) && (
                <div
                  style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: isCurrent ? 'rgba(127,212,200,0.35)' : 'rgba(255,255,255,0.14)',
                    border: isCurrent ? `2px solid ${nameColor}` : undefined,
                    boxSizing: 'border-box'
                  }}
                />
              )}
              {Boolean(p.showSpeaker) && (
                <div style={{ color: nameColor, fontSize: nameSize - 8, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{line.who}</div>
              )}
            </div>
          ) : null}
          <div style={{ fontSize: isCurrent ? el.style.fontSize : lineSize, color: el.style.color, whiteSpace: 'pre-wrap' }}>{line.text}</div>
        </div>
      )
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 12, gap: 16, overflow: 'hidden' }}>
          {historyLines.map((line, i) => renderBubble(line, false, `h${i}`))}
          {currentLine && renderBubble(currentLine, true, 'current')}
        </div>
      )
    }
    case 'choice-list':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
          {(Array.isArray(p.choices) ? (p.choices as string[]) : []).map((c, i) => (
            <div key={i} style={{ padding: '8px 16px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}>{c}</div>
          ))}
        </div>
      )
    case 'save-grid':
      return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#888' }}>存档格</div>
    case 'cg-gallery':
      return <GalleryGrid cols={4} rows={2} accent={String(p.accentColor ?? '#e3a64b')} empty={String(p.emptyText ?? '尚未回收任何影像档案')} />
    case 'music-gallery':
      return <GalleryGrid cols={3} rows={2} accent={String(p.accentColor ?? '#e3a64b')} empty={String(p.emptyText ?? '尚未截获任何音频信号')} />
    case 'fragment-gallery':
      return <GalleryGrid cols={3} rows={2} accent={String(p.accentColor ?? '#e3a64b')} empty={String(p.emptyText ?? '尚未解密任何剧情记录')} />
    case 'achievement-list':
      return <AchievementGrid accent={String(p.accentColor ?? '#ffd88a')} cols={Number(p.cols ?? 4)} />
    case 'dictionary-popup':
      return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#999' }}>辞典弹窗</div>
    case 'message-box':
      return <div style={{ padding: 16 }}>{String(p.text ?? '')}</div>
    case 'toolbar':
      return <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, fontSize: 14, color: '#aaa' }}>工具栏</div>
    case 'line':
      return <div style={{ width: '100%', height: '100%', background: el.style.fill }} />
    case 'rect':
    case 'background-mask':
    case 'dialogue-frame':
    case 'dialogue-backdrop':
      return null
    case 'variable-panel':
      return <VariablePanelView el={el} />
    case 'variable-value':
      return <VariableValueView el={el} />
    case 'date-display':
      return <DateDisplayView el={el} />
    case 'newspaper-button':
      return <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{String(p.text ?? '📰 日报')}</span>
    case 'newspaper-panel':
      return <NewspaperPanelView el={el} />
    case 'world-map':
      return <WorldMapView el={el} />
    case 'shop-list': {
      const src = String(p.source ?? 'shop')
      const isInventory = src === 'inventory'
      const rows = isInventory
        ? [
            { name: '苹果', right: '×2', rightColor: '#7fd4c8' },
            { name: '胡萝卜', right: '×1', rightColor: '#7fd4c8' }
          ]
        : [
            { name: '苹果', right: '10金币', rightColor: '#e3a64b' },
            { name: '橙子', right: '18金币', rightColor: '#e3a64b' },
            { name: '胡萝卜', right: '18金币', rightColor: '#e3a64b' }
          ]
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, overflow: 'hidden', boxSizing: 'border-box' }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: el.style.fontSize, color: el.style.color }}>
              <span>{r.name}</span>
              <span style={{ color: r.rightColor, fontWeight: 600 }}>{r.right}</span>
            </div>
          ))}
        </div>
      )
    }
    default:
      return <span>{el.name}</span>
  }
}

function VariablePanelView({ el }: { el: UiElement }): JSX.Element {
  const { project } = useEditor()
  const showGlobal = el.props.showGlobal !== false
  const showLocal = el.props.showLocal !== false
  const vars = project.variables.filter(
    (v) => (showGlobal && v.scope === 'global') || (showLocal && v.scope === 'local')
  )
  const color = el.style.color ?? '#e8edf2'
  const fontSize = el.style.fontSize ?? 22
  if (vars.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#888' }}>
        暂无变量（在「变量」页添加）
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 14, overflow: 'hidden', boxSizing: 'border-box' }}>
      {vars.map((v) => (
        <div key={v.id} style={{ fontSize, color, fontWeight: 600 }}>
          {displayVariableValue(v)}
        </div>
      ))}
    </div>
  )
}

function displayVariableValue(v: { type: string; value: string }): string {
  if (v.type === 'boolean') return v.value === 'true' || v.value === 'True' || v.value === '1' ? '是' : '否'
  return v.value || '—'
}

/** 单个变量值：只显示数值/字符串，不显示变量名 */
function VariableValueView({ el }: { el: UiElement }): JSX.Element {
  const { project } = useEditor()
  const v = project.variables.find((x) => x.id === String(el.props.variableId))
  if (!v) return <span style={{ opacity: 0.5 }}>选择变量…</span>
  return <span>{displayVariableValue(v)}</span>
}

/** 日期显示：公历 xxxx年x月x日（运行时显示 _rs_year/_rs_month/_rs_day，编辑态显示开局日期） */
function DateDisplayView({ el }: { el: UiElement }): JSX.Element {
  const { project } = useEditor()
  const d = project.dateSystem
  const prefix = String(el.props.prefix ?? '公历')
  const text = `${prefix}${d.startYear}年${d.startMonth}月${d.startDay}日`
  return (
    <span style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>{text}</span>
  )
}

/** 日报面板：按「大新闻 / 小新闻」分组展示当日新闻（编辑态用示例新闻） */
function NewspaperPanelView({ el }: { el: UiElement }): JSX.Element {
  const { project } = useEditor()
  const name = String(el.props.newspaperName ?? '每日日报')
  const largeSize = Number(el.props.largeSize ?? 34)
  const smallSize = Number(el.props.smallSize ?? 24)
  const accent = el.style.color ?? '#3a2f1f'
  const items = project.news.length > 0 ? project.news : [{ id: 'x', title: '今日暂无新闻', body: '', size: 'large' as const, triggerVariableId: '', weight: 0 }]
  const large = items.filter((n) => n.size === 'large')
  const small = items.filter((n) => n.size === 'small')
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 24, gap: 16, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', fontSize: smallSize + 14, fontWeight: 700, letterSpacing: 4, color: accent }}>{name}</div>
      <div style={{ height: 1, background: 'rgba(0,0,0,0.18)', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        {large.map((n, i) => (
          <div key={i}>
            <div style={{ fontSize: largeSize, fontWeight: 700, color: accent }}>{n.title}</div>
            {n.body && <div style={{ fontSize: smallSize - 4, color: accent, opacity: 0.72 }}>{n.body}</div>}
          </div>
        ))}
        {small.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(0,0,0,0.12)', paddingTop: 12 }}>
            {small.map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: smallSize - 4, color: accent, opacity: 0.5 }}>·</span>
                <span style={{ fontSize: smallSize, color: accent }}>{n.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** 大地图预览：背景图 + 地点图标 + 玩家标识（编辑态静态缩略，交互见「大地图」标签页） */
function WorldMapView({ el }: { el: UiElement }): JSX.Element {
  const { project } = useEditor()
  const map = project.worldMap
  const w = el.rect.w
  const h = el.rect.h
  // 按比例把地图缩到元素 rect 内
  const scale = Math.min(w / map.width, h / map.height)
  const offX = (w - map.width * scale) / 2
  const offY = (h - map.height * scale) / 2
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'rgba(20,26,34,0.4)' }}>
      <div style={{ position: 'absolute', left: offX, top: offY, width: map.width * scale, height: map.height * scale }}>
        {map.backgroundImage ? (
          <img src={map.backgroundImage} style={{ width: '100%', height: '100%', objectFit: 'fill' }} alt="" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 13 }}>大地图（未设置背景图）</div>
        )}
        {map.locations.map((loc) => (
          <div
            key={loc.id}
            style={{
              position: 'absolute',
              left: loc.x * scale,
              top: loc.y * scale,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2
            }}
          >
            {loc.image ? (
              <img src={loc.image} style={{ width: 24, height: 24, objectFit: 'contain' }} alt="" />
            ) : (
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#7fd4c8', border: '2px solid #fff' }} />
            )}
            <span style={{ fontSize: 10, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{loc.name}</span>
          </div>
        ))}
        {map.locations
          .filter((l) => l.id === map.playerLocationId)
          .map((loc) => (
            <div key={'p' + loc.id} style={{ position: 'absolute', left: loc.x * scale, top: loc.y * scale, transform: 'translate(-50%, -50%)' }}>
              {map.playerMarkerImage ? (
                <img src={map.playerMarkerImage} style={{ width: 26, height: 26, objectFit: 'contain' }} alt="" />
              ) : (
                <span style={{ width: 20, height: 20, borderRadius: '50%', border: '3px solid #ffd88a', boxShadow: '0 0 8px #ffd88a' }} />
              )}
            </div>
          ))}
      </div>
    </div>
  )
}

function GalleryGrid({ cols, rows, accent, empty }: { cols: number; rows: number; accent: string; empty: string }): JSX.Element {
  const n = cols * rows
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 16, padding: 16 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ border: `1px solid ${accent}33`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, opacity: 0.55, fontSize: 14 }}>
          {i === 0 ? empty : '▢'}
        </div>
      ))}
    </div>
  )
}

function AchievementGrid({ accent, cols }: { accent: string; cols: number }): JSX.Element {
  const { project } = useEditor()
  const items = project.achievements.length > 0 ? project.achievements : [{ id: 'x', name: '示例成就', description: '成就说明', icon: '', hidden: false, variable: 'ach_sample' }]
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, padding: 16, overflow: 'hidden' }}>
      {items.map((a) => (
        <div key={a.id} style={{ border: `1px solid ${accent}44`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: '100%', height: 90, background: 'rgba(255,255,255,0.06)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, fontSize: 24 }}>
            {a.icon ? <img src={a.icon} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} alt="" /> : '🏆'}
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{a.description}</div>
        </div>
      ))}
    </div>
  )
}
