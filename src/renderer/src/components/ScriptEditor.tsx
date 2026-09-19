import { useState } from 'react'
import { useEditor } from '../store'
import { BLOCK_CATALOG, createBlock, uid } from '../model'
import type { Block, BlockType, Fragment, Chapter } from '../model'
import { parseRpyFile } from '../parser/rpyParser'
import { fileToChapter } from '../renpy/rpyToProject'
import { saveProject } from '../renpy/saveProject'
import Preview from './Preview'
import BlockInspector from './BlockInspector'

// ============================================================
// 脚本编辑器：章节 → 片段 → 块列表；右键插入块；点击块播放预览
// 支持新增/删除 script(.rpy) 与 label，并实时写回磁盘
// 支持「指令模式」与「代码模式」两种视图来回切换
// ============================================================

function joinWin(a: string, b: string): string {
  return a.replace(/[\\/]+$/, '') + '\\' + b
}

// Richard Studio 自动生成的系统脚本文件（由 saveProject / createProject 写盘）。
// 这些文件被删除后对应功能会失效，脚本文件列表里会标记出来，删除时给出额外警告。
const SYSTEM_SCRIPT_FILES: Record<string, string> = {
  script: '默认剧情脚本（初始 label start）',
  options: '游戏设置（分辨率 / 过渡 / 存档等）',
  characters: '角色定义（头像 / 立绘 / 皮肤）',
  screens: '界面（UI 编辑器里的所有界面）',
  achievements: '成就系统',
  scenes: '场景（背景图）',
  dictionary: '辞典词条',
  variables: '变量系统',
  runtime: '运行时系统（HUD / 存档 / 主题）',
  shop: '商店与背包',
  gallery: '鉴赏画廊（CG / 音乐 / 片段）',
  datesystem: '日程系统（日期 / 天气 / 日报）',
  worldmap: '大地图'
}

function isSystemFile(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SYSTEM_SCRIPT_FILES, name)
}

export default function ScriptEditor(): JSX.Element {
  const { project, addBlock, removeBlock, addChapter, removeChapter, replaceChapter, addFragment, removeFragment, currentProjectPath, setSelectedBlock } = useEditor()
  const [chapterId, setChapterId] = useState(project.chapters[0]?.id ?? '')
  const chapter = project.chapters.find((c) => c.id === chapterId) ?? project.chapters[0]

  const [fragmentId, setFragmentId] = useState(chapter?.fragments[0]?.id ?? '')
  const fragment = chapter?.fragments.find((f) => f.id === fragmentId) ?? chapter?.fragments[0]

  const [menu, setMenu] = useState<{ x: number; y: number; afterId: string | null } | null>(null)
  const [promptMode, setPromptMode] = useState<'script' | 'label' | null>(null)
  const [promptName, setPromptName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [scriptMenu, setScriptMenu] = useState<{ x: number; y: number; kind: 'chapter' | 'fragment' } | null>(null)
  const [pendingOverwrite, setPendingOverwrite] = useState<string | null>(null)
  const [showFileList, setShowFileList] = useState(true)
  const [filesCollapsed, setFilesCollapsed] = useState(false)
  const [confirmDeleteScript, setConfirmDeleteScript] = useState(false)

  // 视图模式：指令（块列表）/ 代码（原始 .rpy 文本）
  const [mode, setMode] = useState<'blocks' | 'code'>('blocks')
  const [codeDraft, setCodeDraft] = useState('')

  const gameDir = currentProjectPath ? joinWin(currentProjectPath, 'game') : ''

  const doSave = async (): Promise<void> => {
    if (!currentProjectPath) return
    setSaveStatus('saving')
    try {
      await saveProject(project, currentProjectPath)
      setSaveStatus('saved')
    } catch (err) {
      setSaveStatus('error')
      setError(String(err))
    }
  }

  const createScript = async (base: string): Promise<void> => {
    const filePath = joinWin(gameDir, `${base}.rpy`)
    try {
      await window.renpyStudio.writeFile(filePath, 'label start:\n    return\n')
      const frag: Fragment = { id: uid('fg-'), name: 'start', blocks: [] }
      const ch: Chapter = { id: uid('cp-'), name: base, filePath, fragments: [frag] }
      addChapter(ch)
      setChapterId(ch.id)
      setFragmentId(frag.id)
    } catch (err) {
      setError(String(err))
    }
  }

  const confirmPrompt = async (): Promise<void> => {
    const name = promptName.trim()
    setError(null)
    if (!name) {
      setError('请输入名称')
      return
    }
    if (promptMode === 'script') {
      if (!currentProjectPath) {
        setError('尚未打开项目')
        return
      }
      const base = name.replace(/\.rpy$/i, '')
      // 重名检查：已存在同名脚本则询问覆盖 / 取消
      const exists = project.chapters.some((c) => c.name.toLowerCase() === base.toLowerCase())
      if (exists) {
        setPendingOverwrite(base)
        return
      }
      await createScript(base)
      setPromptMode(null)
      setPromptName('')
    } else if (chapter) {
      // 新增 label
      if (chapter.filePath) {
        try {
          const content = await window.renpyStudio.readFile(chapter.filePath)
          const next = content.replace(/\s*$/, '') + `\n\nlabel ${name}:\n    return\n`
          await window.renpyStudio.writeFile(chapter.filePath, next)
        } catch (err) {
          setError(String(err))
        }
      }
      const frag: Fragment = { id: uid('fg-'), name, blocks: [] }
      addFragment(chapter.id, frag)
      setFragmentId(frag.id)
    }
    setPromptMode(null)
    setPromptName('')
  }

  const confirmOverwrite = async (): Promise<void> => {
    const base = pendingOverwrite
    setPendingOverwrite(null)
    setPromptMode(null)
    setPromptName('')
    if (!base) return
    await createScript(base)
  }

  const overwriteModal = pendingOverwrite ? (
    <div className="modal-overlay" onClick={() => setPendingOverwrite(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">脚本已存在</div>
        <div className="script-hint">
          项目里已经有一个叫 <b>{pendingOverwrite}.rpy</b> 的脚本了。
          <br />
          是否覆盖它？（覆盖后原脚本内容将被替换为空白新脚本）
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => setPendingOverwrite(null)}>取消</button>
          <button className="btn btn-danger" onClick={confirmOverwrite}>覆盖</button>
        </div>
      </div>
    </div>
  ) : null

  const promptModal = promptMode ? (
    <div className="modal-overlay" onClick={() => setPromptMode(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{promptMode === 'script' ? '新增脚本文件' : '新增 label'}</div>
        <div className="field">
          <div className="field-label">{promptMode === 'script' ? '文件名（不含扩展名）' : 'label 名'}</div>
          <input value={promptName} onChange={(e) => setPromptName(e.target.value)} placeholder={promptMode === 'script' ? '例如 chapter2' : '例如 chapter2_start'} autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmPrompt()} />
        </div>
        {promptMode === 'script' && <div className="script-hint">将创建 {gameDir + '\\'}<b>{promptName.trim() || 'name'}.rpy</b></div>}
        <div className="modal-actions">
          <button className="btn" onClick={() => setPromptMode(null)}>取消</button>
          <button className="btn btn-primary" onClick={confirmPrompt}>创建</button>
        </div>
      </div>
    </div>
  ) : null

  const filePanel = (
    <div className="script-files">
      <div className="script-files-header" onClick={() => setFilesCollapsed((v) => !v)}>
        <span className="script-files-title">📂 脚本文件</span>
        <span className="script-files-toggle">{filesCollapsed ? '▾ 展开' : '▴ 收起'}</span>
      </div>
      {!filesCollapsed && (
        <>
          <div className="script-files-actions">
            <button className="btn btn-primary" onClick={() => setPromptMode('script')}>＋ 新建脚本</button>
            <button className="btn btn-primary" onClick={() => setShowFileList((v) => !v)}>打开已有脚本</button>
          </div>
          {showFileList && (
            <div className="script-files-list">
              {project.chapters.length === 0 ? (
                <div className="script-files-empty">还没有脚本文件，点「＋ 新建脚本」创建一个。</div>
              ) : (
                project.chapters.map((c) => {
                  const sys = isSystemFile(c.name)
                  return (
                    <div
                      key={c.id}
                      className={'script-file' + (sys ? ' system' : '') + (c.id === chapter?.id ? ' active' : '')}
                      onClick={() => selectChapter(c.id)}
                      onContextMenu={(e) => onScriptContext(e, 'chapter')}
                      title={sys ? `系统文件 · ${SYSTEM_SCRIPT_FILES[c.name]}` : `打开 ${c.name}.rpy`}
                    >
                      <span className="script-file-icon">{sys ? '🔒' : '📄'}</span>
                      <span className="script-file-name">{c.name}.rpy</span>
                      {sys && <span className="script-file-badge">系统</span>}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  )

  if (!chapter) {
    return (
      <div className="script-editor">
        <div className="script-left">
          {filePanel}
        </div>
        {promptModal}
        {overwriteModal}
      </div>
    )
  }

  const insertBlock = (type: BlockType): void => {
    if (!fragment) return
    const block = createBlock(type)
    addBlock(chapter.id, fragment.id, block)
    setSelectedBlock(block.id)
    setMenu(null)
  }

  const onContextMenu = (e: React.MouseEvent, blockId: string | null): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, afterId: blockId })
  }

  const selectChapter = (id: string): void => {
    setChapterId(id)
    const ch = project.chapters.find((c) => c.id === id)
    setFragmentId(ch?.fragments[0]?.id ?? '')
  }

  const onScriptContext = (e: React.MouseEvent, kind: 'chapter' | 'fragment'): void => {
    e.preventDefault()
    setScriptMenu({ x: e.clientX, y: e.clientY, kind })
  }

  const deleteScript = async (): Promise<void> => {
    setError(null)
    if (chapter.filePath) {
      try {
        await window.renpyStudio.deletePath(chapter.filePath)
      } catch (err) {
        setError(String(err))
        return
      }
    }
    const remaining = project.chapters.filter((c) => c.id !== chapter.id)
    removeChapter(chapter.id)
    const next = remaining[0]
    setChapterId(next?.id ?? '')
    setFragmentId(next?.fragments[0]?.id ?? '')
  }

  const deleteLabel = async (): Promise<void> => {
    if (!fragment) return
    setError(null)
    if (chapter.filePath) {
      try {
        const content = await window.renpyStudio.readFile(chapter.filePath)
        const parsed = parseRpyFile(chapter.filePath, content)
        const lb = parsed.labels.find((l) => l.name === fragment.name)
        if (lb) {
          const lines = content.split('\n')
          const start = Math.max(0, lb.line - 1)
          const end = Math.min(lines.length, lb.endLine)
          lines.splice(start, end - start)
          await window.renpyStudio.writeFile(chapter.filePath, lines.join('\n'))
        }
      } catch (err) {
        setError(String(err))
        return
      }
    }
    removeFragment(chapter.id, fragment.id)
    const rest = chapter.fragments.filter((f) => f.id !== fragment.id)
    setFragmentId(rest[0]?.id ?? '')
  }

  // 进入代码模式：读取当前章节文件原始内容
  const enterCodeMode = async (): Promise<void> => {
    setError(null)
    if (!chapter.filePath) {
      setError('当前章节没有对应的 .rpy 文件')
      return
    }
    try {
      const content = await window.renpyStudio.readFile(chapter.filePath)
      setCodeDraft(content)
      setMode('code')
    } catch (err) {
      setError(String(err))
    }
  }

  // 代码模式「写入」：写盘 + 重新解析回块视图
  const writeCode = async (): Promise<void> => {
    setError(null)
    if (!chapter.filePath) return
    try {
      await window.renpyStudio.writeFile(chapter.filePath, codeDraft)
      const nc = fileToChapter(chapter.filePath, codeDraft)
      replaceChapter(nc)
      setFragmentId(nc.fragments[0]?.id ?? '')
      setMode('blocks')
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div className="script-editor">
      <div className="script-left">
        {filePanel}

        <div className="script-toolbar">
          <div className="mode-switch">
            <button className={'chip' + (mode === 'blocks' ? ' active' : '')} onClick={() => setMode('blocks')}>指令</button>
            <button className={'chip' + (mode === 'code' ? ' active' : '')} onClick={enterCodeMode}>代码</button>
          </div>

          {mode === 'blocks' ? (
            <>
              <span className="script-select" onContextMenu={(e) => onScriptContext(e, 'fragment')} title="下拉选择已有 label · 右键删除">
                <span className="script-select-label">label</span>
                <select value={fragmentId} onChange={(e) => setFragmentId(e.target.value)}>
                  {chapter.fragments.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </span>
              <button className="btn btn-sm btn-danger" onClick={() => setConfirmDeleteScript(true)}>删除脚本</button>
              <button className="btn btn-sm" onClick={() => setPromptMode('label')}>＋ label</button>
              <button className="btn btn-sm btn-danger" onClick={deleteLabel}>删除 label</button>
              <button className="btn btn-sm btn-primary" onClick={() => void doSave()}>保存</button>
              <span className="script-hint">
                {saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '✓ 已保存' : saveStatus === 'error' ? '✗ 保存失败' : '点击块播放 · 右键插入'}
              </span>
            </>
          ) : (
            <>
              <span className="script-hint" title={chapter.filePath}>代码模式 · {chapter.name}.rpy</span>
              <button className="btn btn-sm btn-primary" onClick={writeCode}>写入并返回</button>
              <button className="btn btn-sm" onClick={() => setMode('blocks')}>取消</button>
            </>
          )}
        </div>

        {error && <div className="warning-banner">⚠️ {error}</div>}

        {mode === 'code' ? (
          <textarea
            className="code-editor"
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            spellCheck={false}
            placeholder="在此直接编辑 Ren'Py 脚本…"
          />
        ) : (
          <>
            {fragment ? (
              <div className="block-list" onContextMenu={(e) => onContextMenu(e, null)}>
                {fragment.blocks.length === 0 && (
                  <div className="empty-state">空白片段 —— 右键插入第一个块</div>
                )}
                {fragment.blocks.map((b, i) => (
                  <BlockRow key={b.id} block={b} index={i} chapterId={chapter.id} fragmentId={fragment.id} onContextMenu={onContextMenu} />
                ))}
              </div>
            ) : (
              <div className="empty-state">这个脚本文件里还没有 label，点上方「＋ label」添加一个开始写剧情。</div>
            )}
            {fragment && <BlockInspector />}
          </>
        )}
      </div>

      <div className="script-right">
        <Preview embedded />
      </div>

      {menu && mode === 'blocks' && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <div className="context-menu-title">插入块</div>
          {groupBlocks().map((g) => (
            <div key={g.category}>
              <div className="context-menu-group">{g.category}</div>
              {g.items.map((d) => (
                <div key={d.type} className="context-menu-item" onClick={() => insertBlock(d.type)}>
                  {d.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {scriptMenu && mode === 'blocks' && (
        <div className="context-menu" style={{ left: scriptMenu.x, top: scriptMenu.y }} onClick={(e) => e.stopPropagation()}>
          {scriptMenu.kind === 'chapter' ? (
            <div className="context-menu-item" onClick={() => { setScriptMenu(null); setConfirmDeleteScript(true) }}>
              🗑 删除脚本「{chapter.name}」
            </div>
          ) : (
            <div className="context-menu-item" onClick={() => { setScriptMenu(null); void deleteLabel() }}>
              🗑 删除 label「{fragment?.name ?? ''}」
            </div>
          )}
        </div>
      )}

      {promptModal}
      {overwriteModal}

      {confirmDeleteScript && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteScript(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">删除脚本</div>
            <div className="script-hint">
              {isSystemFile(chapter.name) ? (
                <>
                  <div className="warning-banner" style={{ marginBottom: 10 }}>
                    ⚠️ <b>{chapter.name}.rpy</b> 是系统文件！
                  </div>
                  它负责「{SYSTEM_SCRIPT_FILES[chapter.name]}」，删除后对应功能将失效，游戏可能无法正常运行。
                  <br />
                  <br />
                  确定仍要删除吗？
                </>
              ) : (
                <>
                  确定要删除脚本 <b>{chapter.name}.rpy</b> 吗？
                  <br />
                  删除后该文件将从 game/ 目录移除，且无法恢复。
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmDeleteScript(false)}>取消</button>
              <button className="btn btn-danger" onClick={() => { setConfirmDeleteScript(false); void deleteScript() }}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function groupBlocks(): { category: string; items: typeof BLOCK_CATALOG }[] {
  const map = new Map<string, typeof BLOCK_CATALOG>()
  for (const d of BLOCK_CATALOG) {
    if (!map.has(d.category)) map.set(d.category, [])
    map.get(d.category)!.push(d)
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
}

function BlockRow({
  block,
  index,
  chapterId,
  fragmentId,
  onContextMenu
}: {
  block: Block
  index: number
  chapterId: string
  fragmentId: string
  onContextMenu: (e: React.MouseEvent, id: string) => void
}): JSX.Element {
  const { selectedBlockId, setSelectedBlock, setPlayFromBlock, removeBlock } = useEditor()

  const summary = blockSummary(block)

  return (
    <div
      className={'block-row' + (selectedBlockId === block.id ? ' selected' : '')}
      onClick={() => {
        setSelectedBlock(block.id)
        setPlayFromBlock(block.id)
      }}
      onContextMenu={(e) => onContextMenu(e, block.id)}
    >
      <span className="block-index">{index + 1}</span>
      <span className="block-type">{blockLabel(block.type)}</span>
      <span className="block-summary">{summary}</span>
      <button
        className="block-del"
        onClick={(e) => {
          e.stopPropagation()
          removeBlock(chapterId, fragmentId, block.id)
        }}
      >
        ✕
      </button>
    </div>
  )
}

function blockLabel(type: BlockType): string {
  return BLOCK_CATALOG.find((d) => d.type === type)?.label ?? type
}

function blockSummary(block: Block): string {
  const p = block.props
  switch (block.type) {
    case 'dialogue':
    case 'narration': {
      const txt = block.content?.map((c) => c.text).join('') ?? ''
      const who = String(p.characterName ?? '旁白')
      return `${who}：${txt.slice(0, 40)}`
    }
    case 'scene':
      return String(p.sceneImage ?? p.sceneName ?? '')
    case 'showCharacter':
      return `${p.characterName ?? ''} ${p.expression ?? ''}`
    case 'sound':
      return String(p.uri ?? '')
    case 'wait':
      return `${p.duration ?? ''}ms`
    case 'branch':
      return `${(p.choices as unknown[] | undefined)?.length ?? 0} 个选项`
    case 'setver':
      return `${p.name ?? ''} = ${p.value ?? ''}`
    case 'comment':
      return String(p.text ?? '')
    case 'floatingText':
      return block.content?.map((c) => c.text).join('') ?? ''
    case 'diceCheck':
      return `DC ${p.threshold ?? ''} · ${(p.modifiers as unknown[] | undefined)?.length ?? 0} 变量`
    case 'mergedChoice':
      return `${(p.choices as unknown[] | undefined)?.length ?? 0} 个选项（合并）`
    default:
      return ''
  }
}
