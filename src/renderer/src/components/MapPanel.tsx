import { useRef, useState, useCallback, useEffect } from 'react'
import { useEditor } from '../store'
import { uid } from '../model'
import type { MapLocation, WorldMap } from '../model'
import AssetPickerButton from './AssetPickerButton'

// ============================================================
// 大地图编辑器
//   · 滚轮缩放（以鼠标为中心）、左键拖曳平移、边缘自动滚动
//   · 点击空白处新建地点、拖拽移动地点
//   · 右侧编辑地图设置 + 选中地点的属性
// ============================================================

interface Camera {
  cx: number // 地图坐标（视口中心点）
  cy: number
  zoom: number
}

export default function MapPanel(): JSX.Element {
  const { project, updateWorldMap, addLocation, updateLocation, removeLocation } = useEditor()
  const map = project.worldMap

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [camera, setCamera] = useState<Camera>({ cx: map.width / 2, cy: map.height / 2, zoom: 0.5 })
  const [hoverId, setHoverId] = useState<string | null>(null)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [vp, setVp] = useState<{ w: number; h: number }>({ w: 1200, h: 800 })
  const interactRef = useRef<{ mode: 'pan' | 'move'; locId: string | null; sx: number; sy: number; startCam: Camera; startLoc: { x: number; y: number } | null; moved: boolean } | null>(null)

  // 测量视口尺寸
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setVp({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const clampZoom = useCallback(
    (z: number): number => Math.min(map.maxZoom, Math.max(map.minZoom, z)),
    [map.minZoom, map.maxZoom]
  )

  // 屏幕坐标 -> 地图坐标
  const screenToMap = useCallback(
    (sx: number, sy: number): { x: number; y: number } => ({
      x: (sx - vp.w / 2) / camera.zoom + camera.cx,
      y: (sy - vp.h / 2) / camera.zoom + camera.cy
    }),
    [camera, vp]
  )

  // 地图坐标 -> 屏幕坐标
  const mapToScreen = useCallback(
    (mx: number, my: number): { x: number; y: number } => ({
      x: (mx - camera.cx) * camera.zoom + vp.w / 2,
      y: (my - camera.cy) * camera.zoom + vp.h / 2
    }),
    [camera, vp]
  )

  const hitTest = useCallback(
    (sx: number, sy: number): MapLocation | null => {
      const hitR = 24
      for (const loc of map.locations) {
        const p = mapToScreen(loc.x, loc.y)
        if (Math.hypot(p.x - sx, p.y - sy) <= hitR) return loc
      }
      return null
    },
    [map.locations, mapToScreen]
  )

  const onWheel = (e: React.WheelEvent): void => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const before = screenToMap(sx, sy)
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const nz = clampZoom(camera.zoom * factor)
    setCamera((c) => {
      const z = clampZoom(c.zoom * factor)
      return {
        zoom: z,
        cx: before.x - (sx - vp.w / 2) / z,
        cy: before.y - (sy - vp.h / 2) / z
      }
    })
  }

  const onMouseDown = (e: React.MouseEvent): void => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const hit = hitTest(sx, sy)
    if (hit) {
      setSelectedId(hit.id)
      interactRef.current = { mode: 'move', locId: hit.id, sx, sy, startCam: camera, startLoc: { x: hit.x, y: hit.y }, moved: false }
    } else {
      setSelectedId(null)
      interactRef.current = { mode: 'pan', locId: null, sx, sy, startCam: camera, startLoc: null, moved: false }
    }
  }

  const onMouseMove = (e: React.MouseEvent): void => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const st = interactRef.current

    if (st) {
      const dx = sx - st.sx
      const dy = sy - st.sy
      if (Math.hypot(dx, dy) > 3) st.moved = true
      if (st.mode === 'pan') {
        setCamera((c) => ({ ...c, cx: st.startCam.cx - dx / c.zoom, cy: st.startCam.cy - dy / c.zoom }))
      } else if (st.mode === 'move' && st.locId && st.startLoc) {
        const m = screenToMap(sx, sy)
        updateLocation(st.locId, { x: Math.round(m.x), y: Math.round(m.y) })
      }
    } else {
      // 悬停检测（用于高亮 + 移动路径预览）
      const h = hitTest(sx, sy)
      setHoverId((prev) => (prev !== (h?.id ?? null) ? (h?.id ?? null) : prev))
    }
  }

  const onMouseUp = (e: React.MouseEvent): void => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const st = interactRef.current
    interactRef.current = null
    if (!st) return
    // 未拖动且在空白处 → 新建地点
    if (!st.moved && st.mode === 'pan') {
      const m = screenToMap(sx, sy)
      const loc: MapLocation = {
        id: uid('loc-'),
        name: '新地点',
        image: '',
        tooltip: '前往这里',
        targetLabel: '',
        x: Math.round(m.x),
        y: Math.round(m.y),
        iconWidth: 0
      }
      addLocation(loc)
      setSelectedId(loc.id)
    }
  }

  useEffect(() => {
    const up = (): void => {
      interactRef.current = null
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const selected = map.locations.find((l) => l.id === selectedId) ?? null
  const playerLoc = map.locations.find((l) => l.id === map.playerLocationId) ?? null
  // 移动路径预览：玩家所在地 -> 悬停/选中的地点
  const travelTarget = hoverId ? (map.locations.find((l) => l.id === hoverId) ?? null) : null

  return (
    <div className="map-panel">
      <div className="map-canvas-wrap">
        <div
          ref={viewportRef}
          className="map-viewport"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          style={{ cursor: interactRef.current ? 'grabbing' : 'default' }}
        >
          <MapCanvas
            map={map}
            camera={camera}
            vp={vp}
            selectedId={selectedId}
            hoverId={hoverId}
            playerLoc={playerLoc}
            travelTarget={travelTarget}
            mapToScreen={mapToScreen}
          />
          <div className="map-zoom-controls">
            <button className="btn btn-sm" onClick={() => setCamera((c) => ({ ...c, zoom: clampZoom(c.zoom * 1.25) }))}>＋</button>
            <button className="btn btn-sm" onClick={() => setCamera((c) => ({ ...c, zoom: clampZoom(c.zoom / 1.25) }))}>－</button>
            <button className="btn btn-sm" onClick={() => setCamera({ cx: map.width / 2, cy: map.height / 2, zoom: 0.5 })}>回中</button>
          </div>
        </div>
      </div>

      <div className="map-sidebar">
        <MapSettings map={map} updateWorldMap={updateWorldMap} />
        <LocationList
          locations={map.locations}
          playerLocationId={map.playerLocationId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSetPlayer={(id) => updateWorldMap({ playerLocationId: id })}
          onDelete={removeLocation}
        />
        {selected && (
          <LocationEditor loc={selected} updateLocation={updateLocation} />
        )}
      </div>
    </div>
  )
}

// ---------- 画布 ----------

function MapCanvas({
  map,
  camera,
  vp,
  selectedId,
  hoverId,
  playerLoc,
  travelTarget,
  mapToScreen
}: {
  map: WorldMap
  camera: Camera
  vp: { w: number; h: number }
  selectedId: string | null
  hoverId: string | null
  playerLoc: MapLocation | null
  travelTarget: MapLocation | null
  mapToScreen: (mx: number, my: number) => { x: number; y: number }
}): JSX.Element {
  const bg = mapToScreen(0, 0)
  const zoom = camera.zoom

  const playerPos = playerLoc ? mapToScreen(playerLoc.x, playerLoc.y) : null

  return (
    <div className="map-world" style={{ width: map.width, height: map.height, transform: `translate(${bg.x}px, ${bg.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
      {map.backgroundImage ? (
        <img src={map.backgroundImage} className="map-bg-img" alt="" draggable={false} />
      ) : (
        <div className="map-bg-placeholder">尚未设置地图背景图（在右侧「地图设置」选择）</div>
      )}

      {/* 移动路径虚线（玩家 -> 悬停/选中地点） */}
      {playerPos && travelTarget && travelTarget.id !== playerLoc?.id && (
        <svg className="map-travel-line" style={{ position: 'absolute', left: 0, top: 0, width: map.width, height: map.height }}>
          <TravelArc from={playerPos} to={mapToScreen(travelTarget.x, travelTarget.y)} />
        </svg>
      )}

      {/* 地点图标 */}
      {map.locations.map((loc) => {
        const p = mapToScreen(loc.x, loc.y)
        const isSel = loc.id === selectedId
        const isHover = loc.id === hoverId
        return (
          <div
            key={loc.id}
            className={'map-location' + (isSel ? ' selected' : '') + (isHover ? ' hover' : '')}
            style={{ left: p.x, top: p.y }}
          >
            <div className="map-loc-icon">
              {loc.image ? <img src={loc.image} alt="" draggable={false} /> : <span className="map-loc-dot" />}
            </div>
            <div className="map-loc-name">{loc.name}</div>
          </div>
        )
      })}

      {/* 玩家标识 */}
      {playerPos && (
        <div className="map-player" style={{ left: playerPos.x, top: playerPos.y }}>
          {map.playerMarkerImage ? (
            <img src={map.playerMarkerImage} alt="" draggable={false} />
          ) : (
            <span className="map-player-pulse" />
          )}
        </div>
      )}
    </div>
  )
}

/** 带弧度的虚线：从 from 到 to 画一条二次贝塞尔虚线 */
function TravelArc({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }): JSX.Element {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  // 控制点：垂直偏移，形成弧度
  const sag = Math.min(len * 0.25, 160)
  const cxp = mx - (dy / len) * sag
  const cyp = my + (dx / len) * sag

  const pts: string[] = []
  const N = 32
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const a = (1 - t) * (1 - t)
    const b = 2 * (1 - t) * t
    const c = t * t
    const x = a * from.x + b * cxp + c * to.x
    const y = a * from.y + b * cyp + c * to.y
    if (i % 2 === 0) pts.push(`${x},${y}`)
  }
  return <polyline points={pts.join(' ')} fill="none" stroke="#ffffff" strokeWidth={3} strokeDasharray="8 8" opacity={0.75} strokeLinecap="round" />
}

// ---------- 地图设置 ----------

function MapSettings({ map, updateWorldMap }: { map: WorldMap; updateWorldMap: (p: Partial<WorldMap>) => void }): JSX.Element {
  return (
    <div className="map-section">
      <div className="panel-title">地图设置</div>
      <div className="panel-section">
        <Field label="地图背景图">
          <div className="asset-row">
            <input value={map.backgroundImage} onChange={(e) => updateWorldMap({ backgroundImage: e.target.value })} placeholder="背景图路径" />
            <AssetPickerButton kind="image" onPick={(p) => updateWorldMap({ backgroundImage: p.dataUrl ?? p.relativePath ?? p.path })} />
          </div>
        </Field>
        <Field label="地图尺寸（像素）">
          <div className="grid-2">
            <input type="number" value={map.width} onChange={(e) => updateWorldMap({ width: Math.max(100, +e.target.value) })} placeholder="宽" />
            <input type="number" value={map.height} onChange={(e) => updateWorldMap({ height: Math.max(100, +e.target.value) })} placeholder="高" />
          </div>
        </Field>
        <Field label="玩家标识图片（留空用默认圆点）">
          <div className="asset-row">
            <input value={map.playerMarkerImage} onChange={(e) => updateWorldMap({ playerMarkerImage: e.target.value })} placeholder="标识图片路径" />
            <AssetPickerButton kind="image" onPick={(p) => updateWorldMap({ playerMarkerImage: p.dataUrl ?? p.relativePath ?? p.path })} />
          </div>
        </Field>
        <Field label="边缘自动滚动距离（像素）">
          <input type="number" value={map.edgeScrollMargin} onChange={(e) => updateWorldMap({ edgeScrollMargin: Math.max(0, +e.target.value) })} />
        </Field>
        <div className="grid-2">
          <Field label="最小缩放">
            <input type="number" step={0.05} value={map.minZoom} onChange={(e) => updateWorldMap({ minZoom: Math.max(0.05, +e.target.value) })} />
          </Field>
          <Field label="最大缩放">
            <input type="number" step={0.5} value={map.maxZoom} onChange={(e) => updateWorldMap({ maxZoom: Math.min(20, +e.target.value) })} />
          </Field>
        </div>
        <p className="hint-text">地图尺寸大于游戏窗口时才能拖动/滚动；滚轮缩放、左键拖拽、鼠标靠近边缘自动滚动在游戏运行时生效。</p>
      </div>
    </div>
  )
}

// ---------- 地点列表 ----------

function LocationList({
  locations,
  playerLocationId,
  selectedId,
  onSelect,
  onSetPlayer,
  onDelete
}: {
  locations: MapLocation[]
  playerLocationId: string
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSetPlayer: (id: string) => void
  onDelete: (id: string) => void
}): JSX.Element {
  return (
    <div className="map-section">
      <div className="panel-title">
        地点
        <span className="hint-text" style={{ marginLeft: 8 }}>（点击空白处新建）</span>
      </div>
      <div className="map-loc-list">
        {locations.map((loc) => (
          <div key={loc.id} className={'map-loc-item' + (loc.id === selectedId ? ' active' : '')} onClick={() => onSelect(loc.id)}>
            <span className="map-loc-item-name">
              {loc.name}
              {loc.id === playerLocationId && <span className="map-loc-player-tag">玩家</span>}
            </span>
            <div className="map-loc-item-actions">
              {loc.id !== playerLocationId && (
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onSetPlayer(loc.id) }}>设为玩家</button>
              )}
              <button className="block-del" onClick={(e) => { e.stopPropagation(); onDelete(loc.id) }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- 地点属性 ----------

function LocationEditor({ loc, updateLocation }: { loc: MapLocation; updateLocation: (id: string, patch: Partial<MapLocation>) => void }): JSX.Element {
  return (
    <div className="map-section">
      <div className="panel-title">地点属性</div>
      <div className="panel-section">
        <Field label="名称">
          <input value={loc.name} onChange={(e) => updateLocation(loc.id, { name: e.target.value })} />
        </Field>
        <Field label="图标（透明底 PNG）">
          <div className="asset-row">
            <input value={loc.image} onChange={(e) => updateLocation(loc.id, { image: e.target.value })} placeholder="图标图片路径" />
            <AssetPickerButton kind="image" onPick={(p) => updateLocation(loc.id, { image: p.dataUrl ?? p.relativePath ?? p.path })} />
          </div>
        </Field>
        <Field label="图标宽度（像素，0 = 自适应）">
          <input type="number" value={loc.iconWidth} onChange={(e) => updateLocation(loc.id, { iconWidth: Math.max(0, +e.target.value) })} />
        </Field>
        <Field label="悬停气泡文字">
          <input value={loc.tooltip} onChange={(e) => updateLocation(loc.id, { tooltip: e.target.value })} />
        </Field>
        <Field label="点击跳转的 label（留空只移动）">
          <input value={loc.targetLabel} onChange={(e) => updateLocation(loc.id, { targetLabel: e.target.value })} placeholder="如 home / school" />
        </Field>
        <div className="grid-2">
          <Field label="X">
            <input type="number" value={loc.x} onChange={(e) => updateLocation(loc.id, { x: Math.round(+e.target.value) })} />
          </Field>
          <Field label="Y">
            <input type="number" value={loc.y} onChange={(e) => updateLocation(loc.id, { y: Math.round(+e.target.value) })} />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ---------- 通用 ----------

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
    </div>
  )
}
