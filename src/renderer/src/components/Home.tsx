import { useEffect, useState } from 'react'
import { useEditor } from '../store'
import { rpyToProject } from '../renpy/rpyToProject'
import type { ProjectEntry } from '../../../shared/types'

// ============================================================
// 启动首页：选择 / 新建 / 删除失效项目
// ============================================================

export default function Home(): JSX.Element {
  const { loadProject, setCurrentProjectPath, setActiveTab } = useEditor()
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [parentDir, setParentDir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    const list = await window.renpyStudio.listProjects()
    setProjects(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh().catch(() => setLoading(false))
  }, [])

  const open = async (path: string): Promise<void> => {
    setBusy(path)
    setError(null)
    try {
      const res = await window.renpyStudio.loadProject(path)
      if (!res) {
        setError('打开失败：项目目录已失效')
        refresh()
        return
      }
      loadProject(rpyToProject(res.name, res.files))
      setCurrentProjectPath(path)
      setActiveTab('script')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(null)
    }
  }

  const addExisting = async (): Promise<void> => {
    setError(null)
    const entry = await window.renpyStudio.addProject()
    if (entry) refresh()
  }

  const browseParent = async (): Promise<void> => {
    const dir = await window.renpyStudio.chooseDirectory('选择项目存放位置')
    if (dir) setParentDir(dir)
  }

  const create = async (): Promise<void> => {
    setError(null)
    if (!newName.trim()) {
      setError('请输入项目名')
      return
    }
    if (!parentDir) {
      setError('请选择父目录')
      return
    }
    const entry = await window.renpyStudio.createProject(parentDir, newName.trim())
    if (entry) {
      setShowCreate(false)
      setNewName('')
      refresh()
    }
  }

  const remove = async (path: string): Promise<void> => {
    setBusy(path)
    const list = await window.renpyStudio.removeProject(path)
    setProjects(list)
    setBusy(null)
  }

  return (
    <div className="home">
      <div className="home-inner">
        <div className="home-header">
          <div>
            <div className="home-title">Richard Studio</div>
            <div className="home-subtitle">Ren'Py 可视化编辑器 —— 选择或创建一个项目开始</div>
          </div>
          <div className="home-actions">
            <button className="btn" onClick={addExisting}>打开已有项目</button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>＋ 新建项目</button>
          </div>
        </div>

        {error && <div className="warning-banner">⚠️ {error}</div>}

        {loading ? (
          <div className="empty-state">加载项目列表…</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            还没有项目。
            <br />
            <br />
            点击「＋ 新建项目」创建一个标准 Ren'Py 项目，或「打开已有项目」登记一个已存在的项目文件夹。
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <div key={p.path} className={'project-card' + (p.valid ? '' : ' invalid')}>
                <div className="project-card-icon">{p.valid ? '📁' : '⚠️'}</div>
                <div className="project-card-name">{p.name}</div>
                <div className="project-card-path" title={p.path}>{p.path}</div>
                {p.valid ? (
                  <button className="btn btn-primary" disabled={busy === p.path} onClick={() => open(p.path)}>
                    {busy === p.path ? '打开中…' : '打开'}
                  </button>
                ) : (
                  <div className="project-card-invalid">
                    <span>已失效（目录不存在）</span>
                    <button className="btn btn-danger btn-sm" disabled={busy === p.path} onClick={() => remove(p.path)}>从列表移除</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">新建项目</div>
            <div className="field">
              <div className="field-label">项目名</div>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如：我的视觉小说" autoFocus />
            </div>
            <div className="field">
              <div className="field-label">存放位置（父目录）</div>
              <div className="fill-image-row">
                <input value={parentDir} readOnly placeholder="点击右侧选择目录" />
                <button className="btn btn-sm" onClick={browseParent}>浏览…</button>
              </div>
            </div>
            <div className="script-hint" style={{ marginTop: 8 }}>将创建 game/ 目录、script.rpy、options.rpy 及 assets/ 归档目录。</div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreate(false)}>取消</button>
              <button className="btn btn-primary" onClick={create}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
