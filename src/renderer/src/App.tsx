import { useState, useEffect, useRef } from 'react'
import { useEditor, type Tab } from './store'
import Canvas from './components/Canvas'
import PropertyPanel from './components/PropertyPanel'
import ScriptEditor from './components/ScriptEditor'
import CharactersPanel from './components/CharactersPanel'
import AchievementsPanel from './components/AchievementsPanel'
import DictionaryPanel from './components/DictionaryPanel'
import BranchEditor from './components/BranchEditor'
import VariablesPanel from './components/VariablesPanel'
import SchedulePanel from './components/SchedulePanel'
import MapPanel from './components/MapPanel'
import FontSettings from './components/FontSettings'
import DictionaryPopup from './components/DictionaryPopup'
import Home from './components/Home'
import { exportScreen, exportScript } from './renpy/exportRenpy'
import { saveProject } from './renpy/saveProject'

const TABS: { key: Tab; label: string }[] = [
  { key: 'ui', label: 'UI 编辑器' },
  { key: 'script', label: '脚本' },
  { key: 'characters', label: '角色' },
  { key: 'achievements', label: '成就' },
  { key: 'dictionary', label: '辞典' },
  { key: 'variables', label: '变量' },
  { key: 'schedule', label: '日程' },
  { key: 'map', label: '大地图' },
  { key: 'branch', label: '分支' }
]

export default function App(): JSX.Element {
  const { project, activeTab, setActiveTab, selectedScreen, setSelectedScreen, currentProjectPath, setCurrentProjectPath } = useEditor()
  const [showExport, setShowExport] = useState(false)
  const [showFont, setShowFont] = useState(false)
  const [exportKind, setExportKind] = useState<'screen' | 'script'>('screen')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const firstRunRef = useRef(true)

  // 全局自动保存：项目任何改动 1.5s 无操作后写回磁盘
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false
      return
    }
    if (!currentProjectPath) return
    const t = setTimeout(() => {
      setSaveStatus('saving')
      saveProject(project, currentProjectPath)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, 1500)
    return () => clearTimeout(t)
  }, [project, currentProjectPath])

  const manualSave = (): void => {
    if (!currentProjectPath) return
    setSaveStatus('saving')
    saveProject(project, currentProjectPath)
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('error'))
  }

  if (!currentProjectPath) {
    return <Home />
  }

  const exportCode =
    exportKind === 'screen'
      ? exportScreen(project.uiScreens[selectedScreen] ?? Object.values(project.uiScreens)[0], 'say')
      : exportScript(project)

  const saveHint =
    saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '✓ 已保存' : saveStatus === 'error' ? '✗ 失败' : ''

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Richard Studio</div>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => {
            // 简单改名（通过 store 未提供，直接改显示，正式版加 action）
          }}
        />
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={'tab' + (activeTab === t.key ? ' active' : '')}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button className="btn btn-primary" onClick={manualSave}>保存</button>
        <span className="save-hint">{saveHint}</span>
        <button className="btn" onClick={() => setShowFont(true)}>字体</button>
        <button className="btn" onClick={() => setShowExport(true)}>查看代码</button>
        <button className="btn" onClick={() => setCurrentProjectPath(null)}>返回首页</button>
      </header>

      <main className="main">
        {activeTab === 'ui' && (
          <div className="ui-editor-layout">
            <ScreenList selected={selectedScreen} onSelect={setSelectedScreen} />
            <Canvas />
            <PropertyPanel />
          </div>
        )}
        {activeTab === 'script' && <ScriptEditor />}
        {activeTab === 'characters' && <CharactersPanel />}
        {activeTab === 'achievements' && <AchievementsPanel />}
        {activeTab === 'dictionary' && <DictionaryPanel />}
        {activeTab === 'variables' && <VariablesPanel />}
        {activeTab === 'schedule' && <SchedulePanel />}
        {activeTab === 'map' && <MapPanel />}
        {activeTab === 'branch' && <BranchEditor />}
      </main>

      <DictionaryPopup />

      {showFont && <FontSettings onClose={() => setShowFont(false)} />}

      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">查看代码（预览）</div>
            <div className="warning-banner" style={{ marginBottom: 10 }}>
              ✅ 你在编辑器里的所有修改，都已自动写入项目 <b>game/</b> 目录下的 .rpy 文件，无需手动复制。此处仅供预览代码。
            </div>
            <div className="export-tabs">
              <button className={'chip' + (exportKind === 'screen' ? ' active' : '')} onClick={() => setExportKind('screen')}>界面 screen</button>
              <button className={'chip' + (exportKind === 'script' ? ' active' : '')} onClick={() => setExportKind('script')}>脚本</button>
            </div>
            <pre className="code-output">{exportCode}</pre>
            <div className="modal-actions">
              <button className="btn" onClick={() => navigator.clipboard.writeText(exportCode)}>复制</button>
              <button className="btn btn-primary" onClick={() => setShowExport(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 界面分组：游戏内 / 系统（用于侧栏展示顺序与分组）
const SCREEN_GROUPS: { group: string; keys: string[] }[] = [
  { group: '游戏内界面', keys: ['dialogue-box', 'variable-hud', 'map-screen'] },
  { group: '系统界面', keys: ['title-screen', 'history-screen', 'save-screen', 'settings-screen', 'shop-screen', 'newspaper-screen'] },
  { group: '鉴赏与成就', keys: ['gallery-screen', 'achievement-screen'] },
  { group: '辞典', keys: ['dictionary-popup'] }
]

const SCREEN_ICONS: Record<string, string> = {
  'dialogue-box': '💬',
  'variable-hud': '📊',
  'map-screen': '🗺',
  'title-screen': '🏠',
  'history-screen': '🕘',
  'save-screen': '💾',
  'settings-screen': '⚙',
  'shop-screen': '🛒',
  'newspaper-screen': '📰',
  'gallery-screen': '🖼',
  'achievement-screen': '🏆',
  'dictionary-popup': '📖'
}

function ScreenList({ selected, onSelect }: { selected: string; onSelect: (s: string) => void }): JSX.Element {
  const { project } = useEditor()
  const screens = project.uiScreens
  return (
    <div className="screen-list">
      <div className="side-list-header">
        <span>界面</span>
      </div>
      {SCREEN_GROUPS.map((g) => (
        <div key={g.group}>
          <div className="screen-group-title">{g.group}</div>
          {g.keys.filter((k) => screens[k]).map((key) => (
            <div key={key} className={'side-item' + (key === selected ? ' active' : '')} onClick={() => onSelect(key)}>
              <span className="screen-icon">{SCREEN_ICONS[key] ?? '▦'}</span>
              {screens[key].name}
            </div>
          ))}
        </div>
      ))}
      <div className="screen-list-hint">对话框 · 标题 · 历史记录 等界面在此编辑</div>
    </div>
  )
}
