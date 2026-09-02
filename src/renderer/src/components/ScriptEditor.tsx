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

export default function ScriptEditor(): JSX.Element {
  const { project, addBlock, removeBlock, addChapter, removeChapter, replaceChapter, addFragment, removeFragment, currentProjectPath } = useEditor()
  const [chapterId, setChapterId] = useState(project.chapters[0]?.id ?? '')
  const chapter = project.chapters.find((c) => c.id === chapterId) ?? project.chapters[0]

  const [fragmentId, setFragmentId] = useState(chapter?.fragments[0]?.id ?? '')
  const fragment = chapter?.fragments.find((f) => f.id === fragmentId) ?? chapter?.fragments[0]

  const [menu, setMenu] = useState<{ x: number; y: number; afterId: string | null } | null>(null)
  const [promptMode, setPromptMode] = useState<'script' | 'label' | null>(null)
  const [promptName, setPromptName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

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

  if (!chapter || !fragment) {
    return (
      <div className="script-editor">
        <div className="script-left">
          <div className="empty-state">
            还没有脚本文件。
            <br />
            <br />
            <button className="btn btn-primary" onClick={() => setPromptMode('script')}>＋ 新增 script（章节）</button>
          </div>
        </div>
        {promptModal}
      </div>
    )
  }

  const insertBlock = (type: BlockType): void => {
    const block = createBlock(type)
    addBlock(chapter.id, fragment.id, block)
    setMenu(null)
  }

  const onContextMenu = (e: React.MouseEvent, blockId: string | null): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, afterId: blockId })
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
        <div className="script-toolbar">
          <div className="mode-switch">
            <button className={'chip' + (mode === 'blocks' ? ' active' : '')} onClick={() => setMode('blocks')}>指令</button>
            <button className={'chip' + (mode === 'code' ? ' active' : '')} onClick={enterCodeMode}>代码</button>
          </div>

          {mode === 'blocks' ? (
            <>
              <select value={chapterId} onChange={(e) => { setChapterId(e.target.value); const ch = project.chapters.find((c) => c.id === e.target.value); setFragmentId(ch?.fragments[0]?.id ?? '') }}>
                {project.chapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select value={fragmentId} onChange={(e) => setFragmentId(e.target.value)}>
                {chapter.fragments.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button className="btn btn-sm" onClick={() => setPromptMode('script')}>＋ script</button>
              <button className="btn btn-sm btn-danger" onClick={deleteScript}>删除 script</button>
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
            <div className="block-list" onContextMenu={(e) => onContextMenu(e, null)}>
              {fragment.blocks.length === 0 && (
                <div className="empty-state">空白片段 —— 右键插入第一个块</div>
              )}
              {fragment.blocks.map((b, i) => (
                <BlockRow key={b.id} block={b} index={i} chapterId={chapter.id} fragmentId={fragment.id} onContextMenu={onContextMenu} />
              ))}
            </div>
            <BlockInspector />
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

      {promptModal}
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
