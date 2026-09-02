// ============================================================
// 把磁盘上的 game/*.rpy 解析结果映射成内存 Project 模型
// 反向于 exportRenpy：label → 片段，语句 → 块，define → 角色
// ============================================================

import type { Project, Chapter, Fragment, Block, Character, GameVariable, VariableType } from '../model'
import { uid } from '../model'
import { parseProject, parseRpyFile } from '../parser/rpyParser'
import { createDefaultProject } from '../defaults'
import type {
  ProjectScriptFile,
  Statement,
  SayStatement,
  ShowStatement,
  SceneStatement,
  JumpStatement,
  CallStatement,
  MenuStatement
} from '../../../shared/types'

function fileBaseName(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.replace(/\.rpy$/i, '')
}

/**
 * 解析单个 .rpy 文件为章节（代码模式写回后刷新用）。
 * 用空的角色映射，角色按变量名回退为 characterName。
 */
export function fileToChapter(path: string, content: string): Chapter {
  const parsed = parseRpyFile(path, content)
  const emptyMap = new Map<string, string>()
  return {
    id: uid('cp-'),
    name: fileBaseName(path),
    filePath: path,
    fragments: parsed.labels.map((lb) => ({
      id: uid('fg-'),
      name: lb.name,
      blocks: lb.statements
        .map((stmt) => statementToBlock(stmt, emptyMap, emptyMap))
        .filter((b): b is Block => b !== null)
    }))
  }
}

export function rpyToProject(name: string, files: ProjectScriptFile[]): Project {
  const parsed = parseProject(files.map((f) => ({ path: f.path, source: f.content })))

  // 1. 角色定义 + 变量名/显示名 → 角色 id 的映射
  const varToCharId = new Map<string, string>()
  const nameToCharId = new Map<string, string>()
  const characters: Character[] = parsed.characters.map((cd) => {
    const id = uid('ch-')
    varToCharId.set(cd.name, id)
    nameToCharId.set(cd.displayName, id)
    return {
      id,
      name: cd.displayName || cd.name,
      avatar: '',
      expressions: [],
      themeColor: cd.color
        ? { bg: cd.color, fg: '#ffffff', ring: cd.color }
        : { bg: '#2a2e3a', fg: '#e8edf2', ring: '#7fd4c8' },
      defaultPosition: 'center'
    }
  })

  // 2. 每个 .rpy 文件 → 一个章节；每个 label → 一个片段；每个语句 → 一个块
  const chapters: Chapter[] = files.map((f) => {
    const labels = parsed.labels.filter((lb) => parsed.labelToFile[lb.name] === f.path)
    return {
      id: uid('cp-'),
      name: fileBaseName(f.path),
      filePath: f.path,
      fragments: labels.map((lb) => ({
        id: uid('fg-'),
        name: lb.name,
        blocks: lb.statements
          .map((stmt) => statementToBlock(stmt, varToCharId, nameToCharId))
          .filter((b): b is Block => b !== null)
      }))
    }
  })

  // 3. 变量声明（default name = value）→ GameVariable
  const variables: GameVariable[] = parsed.variables.map((vd) => {
    const value = vd.value.trim()
    let type: VariableType = 'number'
    let val = value
    if (/^(True|False)$/.test(value)) {
      type = 'boolean'
      val = value === 'True' ? 'true' : 'false'
    } else if (value.startsWith('"') || value.startsWith("'")) {
      type = 'string'
      val = value.replace(/^["']/, '').replace(/["']$/, '').replace(/\\"/g, '"').replace(/\\'/g, "'")
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      type = 'number'
      val = value
    } else {
      // 无法判断时按字符串处理
      type = 'string'
      val = value
    }
    return { id: uid('var-'), name: vd.name, varName: vd.name, value: val, type, scope: 'global' }
  })

  // UI 界面等暂时用默认模板，脚本/角色/变量用解析结果
  const base = createDefaultProject()
  return {
    ...base,
    name,
    chapters,
    chapterOrder: chapters.map((c) => c.id),
    characters,
    variables
  }
}

function statementToBlock(
  stmt: Statement,
  varToCharId: Map<string, string>,
  nameToCharId: Map<string, string>
): Block | null {
  const id = uid('bl-')
  switch (stmt.type) {
    case 'say': {
      const s = stmt as SayStatement
      const props: Record<string, unknown> = {}
      if (s.who) {
        const cid = varToCharId.get(s.who) ?? nameToCharId.get(s.who)
        if (cid) props.characterId = cid
        else props.characterName = s.who
      }
      return {
        id,
        type: s.who ? 'dialogue' : 'narration',
        props,
        content: [{ type: 'text', text: s.what, styles: {} }]
      }
    }
    case 'scene': {
      const s = stmt as SceneStatement
      return { id, type: 'scene', props: { sceneImage: s.image, sceneName: s.image, imageTag: s.image } }
    }
    case 'show': {
      const s = stmt as ShowStatement
      // `show screen xxx` 是界面显示命令，不是立绘
      if (s.image.startsWith('screen ')) {
        return { id, type: 'showScreen', props: { screenName: s.image.slice('screen '.length).trim() } }
      }
      const parts = s.image.split(/\s+/)
      const tag = parts[0] ?? ''
      const expr = parts.slice(1).join(' ') || ''
      const cid = varToCharId.get(tag) ?? nameToCharId.get(tag)
      const props: Record<string, unknown> = { expression: expr }
      if (cid) props.characterId = cid
      else props.characterName = tag
      return { id, type: 'showCharacter', props }
    }
    case 'hide':
      return { id, type: 'removeCharacter', props: {} }
    case 'jump': {
      const s = stmt as JumpStatement
      return { id, type: 'callFragment', props: { target: s.target } }
    }
    case 'call': {
      const s = stmt as CallStatement
      return { id, type: 'callFragment', props: { target: s.target } }
    }
    case 'menu': {
      const s = stmt as MenuStatement
      return {
        id,
        type: 'branch',
        props: { choices: s.choices.map((c) => ({ text: c.text, targetFragmentId: c.target ?? '' })) }
      }
    }
    case 'return':
      return { id, type: 'returnToEntry', props: {} }
    case 'play':
      return { id, type: 'sound', props: { uri: extractFirstString(stmt.raw) ?? stmt.raw } }
    case 'stop':
      return { id, type: 'stopSound', props: {} }
    case 'pause':
      return { id, type: 'wait', props: { duration: extractNumber(stmt.raw) * 1000 } }
    case 'define':
    case 'image':
      return null // 角色/图片定义已在 characters/images 处理
    case 'python': {
      // $ 变量 = 值 / $ 变量 += 值 等赋值与算术运算 → setver 块
      const code = stmt.raw.replace(/^\$\s*/, '').trim()
      const m = code.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|=)\s*(.+)$/)
      if (m) {
        const opMap: Record<string, string> = { '=': 'set', '+=': 'add', '-=': 'subtract', '*=': 'multiply', '/=': 'divide' }
        return { id, type: 'setver', props: { name: m[1], operation: opMap[m[2]] ?? 'set', value: m[3].trim() } }
      }
      return { id, type: 'comment', props: { text: stmt.raw } }
    }
    default:
      // 未识别语句（if/python/with/window 等）保留为注释块，避免丢内容
      return { id, type: 'comment', props: { text: stmt.raw } }
  }
}

function extractFirstString(raw: string): string | null {
  const m = raw.match(/["']([^"']*)["']/)
  return m ? m[1] : null
}

function extractNumber(raw: string): number {
  const m = raw.match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : 1
}
