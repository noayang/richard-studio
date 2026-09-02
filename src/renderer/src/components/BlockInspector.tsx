import { useState } from 'react'
import { useEditor } from '../store'
import { blockDef } from '../model'
import type { Block, BlockSchema, BlockSchemaField, Chapter, Fragment, Project } from '../model'
import AssetPickerButton, { type PickKind } from './AssetPickerButton'

// ============================================================
// 块参数检查器：根据块的 schema 渲染对应的选择控件
// （资产 / 角色 / 立绘 / 场景 / 转场 / 片段 / 成就 / 对白文本）
// ============================================================

interface Located {
  chapter: Chapter
  fragment: Fragment
  block: Block
}

function findBlock(project: Project, id: string): Located | null {
  for (const chapter of project.chapters) {
    for (const fragment of chapter.fragments) {
      const block = fragment.blocks.find((b) => b.id === id)
      if (block) return { chapter, fragment, block }
    }
  }
  return null
}

export default function BlockInspector(): JSX.Element | null {
  const { project, selectedBlockId } = useEditor()
  if (!selectedBlockId) return null
  const loc = findBlock(project, selectedBlockId)
  if (!loc) return null
  // 用 block.id 作为 key，切换块时重置文本框草稿
  return <BlockEditor key={loc.block.id} loc={loc} />
}

function BlockEditor({ loc }: { loc: Located }): JSX.Element {
  const { project, updateBlock, removeBlock } = useEditor()
  const { chapter, fragment, block } = loc
  const def = blockDef(block.type)
  const schema = def.schema ?? {}

  const hasText = block.type === 'dialogue' || block.type === 'narration' || block.type === 'floatingText'
  const committedText = block.content?.map((c) => c.text).join('') ?? ''
  const [draft, setDraft] = useState(committedText)

  const patchProps = (key: string, value: unknown): void => {
    updateBlock(chapter.id, fragment.id, block.id, { props: { ...block.props, [key]: value } })
  }

  const commitText = (text: string): void => {
    updateBlock(chapter.id, fragment.id, block.id, {
      content: [{ type: 'text', text, styles: {} }]
    })
  }

  return (
    <div className="block-inspector">
      <div className="block-inspector-head">
        <span className="block-type">{def.label}</span>
        <button className="btn btn-sm btn-danger" onClick={() => removeBlock(chapter.id, fragment.id, block.id)}>删除块</button>
      </div>

      {hasText && (
        <div className="bi-section">
          <div className="bi-label">{block.type === 'narration' ? '旁白文本' : block.type === 'floatingText' ? '漂浮文字' : '对白文本'}</div>
          <textarea
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="输入对白… 用 [[词条名]] 引用辞典专有名词"
          />
          <TermInserter onInsert={(term) => setDraft(draft + `[[${term}]]`)} />
          <div className="bi-actions">
            <button className="btn btn-sm btn-primary" onClick={() => commitText(draft)}>确定 / 写入</button>
            <span className="bi-hint">输入后点「确定 / 写入」保存到块，随后自动写盘</span>
          </div>
        </div>
      )}

      {block.type === 'scene' && (
        <SceneImageEditor block={block} onChange={(patch) => updateBlock(chapter.id, fragment.id, block.id, { props: { ...block.props, ...patch } })} />
      )}

      {Object.entries(schema).map(([key, field]) => (
        <FieldRow
          key={key}
          label={field.label ?? key}
          field={field}
          value={block.props[key]}
          blockProps={block.props}
          onChange={(v) => patchProps(key, v)}
        />
      ))}

      {block.type === 'branch' && (
        <BranchEditor block={block} onChange={(choices) => patchProps('choices', choices)} />
      )}

      {block.type === 'diceCheck' && (
        <DiceModifiersEditor block={block} onChange={(mods) => patchProps('modifiers', mods)} />
      )}

      {block.type === 'mergedChoice' && (
        <MergedChoiceEditor block={block} onChange={(choices) => patchProps('choices', choices)} />
      )}
    </div>
  )
}

// ---------- 场景背景图编辑（图片选择 + 层级） ----------

function SceneImageEditor({ block, onChange }: { block: Block; onChange: (patch: Record<string, unknown>) => void }): JSX.Element {
  const sceneImage = String(block.props.sceneImage ?? '')
  const depth = block.props.depth == null ? 1 : Number(block.props.depth)
  return (
    <div className="bi-section">
      <div className="bi-label">背景图</div>
      <div className="fill-image-row">
        <input
          value={sceneImage}
          onChange={(e) => onChange({ sceneImage: e.target.value })}
          placeholder="图片路径 / 相对路径"
        />
        <AssetPickerButton
          kind="image"
          label="插入背景图…"
          onPick={(p) => onChange({ sceneImage: p.relativePath || p.name })}
        />
        <span className="bi-unit" title="距离越大越靠后">层</span>
        <input
          type="number"
          value={depth}
          min={1}
          onChange={(e) => onChange({ depth: +e.target.value })}
          style={{ width: 64, flex: 'none' }}
          title="距离越大越靠后"
        />
      </div>
    </div>
  )
}

// ---------- 分支选项编辑 ----------

interface ChoiceItem {
  text: string
  targetFragmentId?: string
}

function BranchEditor({ block, onChange }: { block: Block; onChange: (choices: ChoiceItem[]) => void }): JSX.Element {
  const { project } = useEditor()
  const choices = (block.props.choices as ChoiceItem[]) ?? []
  const fragments = project.chapters.flatMap((c) => c.fragments.map((f) => ({ chapter: c.name, id: f.id, name: f.name })))

  const set = (i: number, patch: Partial<ChoiceItem>): void => {
    onChange(choices.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  }

  return (
    <div className="bi-section">
      <div className="bi-label">分支选项</div>
      {choices.map((c, i) => (
        <div key={i} className="bi-choice">
          <input value={c.text ?? ''} placeholder={`选项 ${i + 1}`} onChange={(e) => set(i, { text: e.target.value })} />
          <select value={c.targetFragmentId ?? ''} onChange={(e) => set(i, { targetFragmentId: e.target.value || undefined })}>
            <option value="">（停留本片段）</option>
            {fragments.map((f) => (
              <option key={f.id} value={f.id}>{f.chapter} / {f.name}</option>
            ))}
          </select>
          <button className="block-del" onClick={() => onChange(choices.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => onChange([...choices, { text: '' }])}>+ 添加选项</button>
    </div>
  )
}

// ---------- 骰子检定：变量加减列表 ----------

interface DiceModifier {
  variableId: string
  sign: '+' | '-'
}

function DiceModifiersEditor({ block, onChange }: { block: Block; onChange: (mods: DiceModifier[]) => void }): JSX.Element {
  const { project } = useEditor()
  const mods = (block.props.modifiers as DiceModifier[]) ?? []

  const set = (i: number, patch: Partial<DiceModifier>): void => {
    onChange(mods.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  }

  return (
    <div className="bi-section">
      <div className="bi-label">检定变量（加减求和，结果 + 骰子 + 装备加成与阈值比较）</div>
      {mods.map((m, i) => (
        <div key={i} className="bi-choice">
          <select value={m.sign ?? '+'} onChange={(e) => set(i, { sign: e.target.value as '+' | '-' })}>
            <option value="+">＋ 加</option>
            <option value="-">－ 减</option>
          </select>
          <select value={m.variableId ?? ''} onChange={(e) => set(i, { variableId: e.target.value })}>
            <option value="">（选择变量）</option>
            {project.variables.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <button className="block-del" onClick={() => onChange(mods.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => onChange([...mods, { variableId: '', sign: '+' }])}>+ 添加变量</button>
      <div className="bi-hint">这些变量的当前值会相加（减法为负）后与骰子、装备加成一起判定。</div>
    </div>
  )
}

// ---------- 合并选择支：序号选项跳 label ----------

interface MergedChoiceItem {
  text: string
  targetLabel: string
}

function MergedChoiceEditor({ block, onChange }: { block: Block; onChange: (choices: MergedChoiceItem[]) => void }): JSX.Element {
  const choices = (block.props.choices as MergedChoiceItem[]) ?? []

  const set = (i: number, patch: Partial<MergedChoiceItem>): void => {
    onChange(choices.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  }

  return (
    <div className="bi-section">
      <div className="bi-label">选择支（自动编号 1. 2. 3. 合并进旁白，悬停变色，点击跳转 label）</div>
      {choices.map((c, i) => (
        <div key={i} className="bi-choice">
          <input value={c.text ?? ''} placeholder={`选项 ${i + 1}`} onChange={(e) => set(i, { text: e.target.value })} />
          <input value={c.targetLabel ?? ''} placeholder="跳转的 label" onChange={(e) => set(i, { targetLabel: e.target.value })} />
          <button className="block-del" onClick={() => onChange(choices.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => onChange([...choices, { text: '', targetLabel: '' }])}>+ 添加选项</button>
    </div>
  )
}

// ---------- 辞典词条插入 ----------

function TermInserter({ onInsert }: { onInsert: (term: string) => void }): JSX.Element {
  const { project } = useEditor()
  if (project.dictionary.length === 0) return <div className="bi-hint">辞典暂无词条（在「辞典」页添加）</div>
  return (
    <div className="bi-term-insert">
      <select id="term-sel">
        {project.dictionary.map((d) => (
          <option key={d.id} value={d.term}>{d.term}</option>
        ))}
      </select>
      <button
        className="btn btn-sm"
        onClick={() => {
          const sel = document.getElementById('term-sel') as HTMLSelectElement | null
          if (sel?.value) onInsert(sel.value)
        }}
      >
        + 插入词条链接
      </button>
    </div>
  )
}

// ---------- 字段渲染 ----------

function FieldRow({ label, field, value, blockProps, onChange }: { label: string; field: BlockSchemaField; value: unknown; blockProps: Record<string, unknown>; onChange: (v: unknown) => void }): JSX.Element {
  return (
    <div className="bi-field">
      <div className="bi-label">{label}</div>
      <FieldControl field={field} value={value} blockProps={blockProps} onChange={onChange} />
    </div>
  )
}

function FieldControl({ field, value, blockProps, onChange }: { field: BlockSchemaField; value: unknown; blockProps: Record<string, unknown>; onChange: (v: unknown) => void }): JSX.Element {
  const { project } = useEditor()
  const str = (v: unknown): string => (v == null ? '' : String(v))

  switch (field.type) {
    case 'string':
      if (field.multiline) {
        return <textarea rows={2} value={str(value)} onChange={(e) => onChange(e.target.value)} />
      }
      return <input value={str(value)} onChange={(e) => onChange(e.target.value)} placeholder={field.label} />

    case 'number':
      return (
        <div className="bi-num">
          <input
            type="number"
            value={value == null || value === '' ? '' : String(value)}
            min={field.min}
            max={field.max}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
          {field.unit && <span className="bi-unit">{field.unit}</span>}
        </div>
      )

    case 'boolean':
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />

    case 'enum':
      return (
        <select value={str(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">（未选择）</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )

    case 'asset': {
      const kind: PickKind =
        field.assetType === 'audio' ? 'audio' : field.assetType === 'video' ? 'video' : field.assetType === 'image' ? 'image' : 'any'
      return (
        <div className="fill-image-row">
          <input value={str(value)} onChange={(e) => onChange(e.target.value)} placeholder="资源路径 / 图片标签" />
          <AssetPickerButton kind={kind} label="…" onPick={(p) => onChange(p.relativePath || p.name)} />
        </div>
      )
    }

    case 'character':
      return (
        <select value={str(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">（选择角色）</option>
          {project.characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )

    case 'characterPortrait': {
      const charId = field.characterField ? str(blockProps[field.characterField]) : ''
      const linkedChar = project.characters.find((c) => c.id === charId)
      const chars = linkedChar ? [linkedChar] : project.characters
      return (
        <select value={str(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">（默认表情）</option>
          {chars.flatMap((c) =>
            c.expressions.map((ex) => (
              <option key={c.id + ex.name} value={ex.name}>
                {linkedChar ? ex.name : `${c.name} · ${ex.name}`}
              </option>
            ))
          )}
        </select>
      )
    }

    case 'characterSkin': {
      const charId = field.characterField ? str(blockProps[field.characterField]) : ''
      const exprName = field.expressionField ? str(blockProps[field.expressionField]) : ''
      const linkedChar = project.characters.find((c) => c.id === charId)
      const linkedExpr = linkedChar?.expressions.find((ex) => ex.name === exprName)
      const skins = linkedExpr?.skins ?? []
      return (
        <select value={str(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">（无皮肤）</option>
          {skins.map((sk) => (
            <option key={sk.id} value={sk.name}>{sk.name}</option>
          ))}
        </select>
      )
    }

    case 'scene':
      return (
        <select value={str(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">（选择场景）</option>
          {project.scenes.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )

    case 'fragment':
      return (
        <select value={str(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">（选择片段）</option>
          {project.chapters.flatMap((c) =>
            c.fragments.map((f) => (
              <option key={f.id} value={f.id}>{c.name} / {f.name}</option>
            ))
          )}
        </select>
      )

    case 'achievement':
      return (
        <select value={str(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">（选择成就）</option>
          {project.achievements.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )

    case 'position':
      return <input value={str(value)} placeholder="(50%, 50%)" onChange={(e) => onChange(e.target.value)} />

    case 'color':
      return <input type="color" value={str(value) || '#000000'} onChange={(e) => onChange(e.target.value)} />

    case 'variable':
      return (
        <select value={str(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">（选择变量）</option>
          {project.variables.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      )
  }
}
