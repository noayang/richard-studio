// ============================================================
// Ren'Py .rpy 脚本解析器
// 解析 label / menu / jump / call / say / show / scene / define / image 等，
// 输出结构化 AST，供剧情树与场景搭建器使用。
// ============================================================

import type {
  RpyParseResult,
  LabelBlock,
  Statement,
  SayStatement,
  ShowStatement,
  SceneStatement,
  DefaultStatement,
  JumpStatement,
  CallStatement,
  MenuStatement,
  LabelStatement,
  CharacterDef,
  ImageDef,
  StoryEdge,
  Choice,
  ProjectParseResult
} from '../../../shared/types'

// ---------- 基础工具 ----------

/** 去除行内注释（# 开头的部分），但不触碰字符串内部 */
export function stripComment(line: string): string {
  let inString: '"' | "'" | null = null
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = ch
      continue
    }
    if (ch === '#') {
      return line.slice(0, i)
    }
  }
  return line
}

/** 提取字符串字面量（含位置）。返回 {value(不含引号), start, quote} */
interface StringToken {
  value: string
  start: number
  quote: '"' | "'"
}

export function extractStrings(text: string): StringToken[] {
  const result: StringToken[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      const start = i
      let j = i + 1
      let value = ''
      while (j < text.length) {
        const c = text[j]
        if (c === '\\') {
          value += c + (text[j + 1] ?? '')
          j += 2
          continue
        }
        if (c === quote) {
          j++
          break
        }
        value += c
        j++
      }
      result.push({ value, start, quote })
      i = j
    } else {
      i++
    }
  }
  return result
}

/** 去除引号并还原基本转义 */
function unquote(raw: string): string {
  return raw
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\\//g, '/')
    .replace(/\\([{}])/g, '$1')
    .replace(/\[([^\]]*)\]/g, '$1') // 移除插值 [var]
}

/** 计算缩进层级（tab 计 4 空格） */
function indentOf(line: string): number {
  let n = 0
  for (const ch of line) {
    if (ch === ' ') n++
    else if (ch === '\t') n += 4
    else break
  }
  return n
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/

// ---------- 语句分类 ----------

/** 解析一行，返回基础 Statement 或 null（空行/注释） */
function classifyLine(rawLine: string, lineNo: number): Statement | null {
  const line = rawLine.trim()
  if (line === '') return null

  // 去除注释后再判断
  const noComment = stripComment(rawLine)
  const code = noComment.trim()
  if (code === '') return null

  const indent = indentOf(rawLine)
  const base = { line: lineNo, raw: code, indent }

  // label
  let m = code.match(/^label\s+([A-Za-z_][A-Za-z0-9_.]*)\s*:/)
  if (m) {
    const s: LabelStatement = { ...base, type: 'label', name: m[1] }
    return s
  }

  // menu
  if (/^menu\s*(\([^)]*\))?\s*:/.test(code)) {
    const s: MenuStatement = { ...base, type: 'menu', choices: [] }
    return s
  }

  // scene
  m = code.match(/^scene\s+(.+)$/)
  if (m) {
    const rest = m[1]
    const { image, at } = parseShowClause(rest)
    const s: SceneStatement = { ...base, type: 'scene', image, at }
    return s
  }

  // show
  m = code.match(/^show\s+(.+)$/)
  if (m) {
    const rest = m[1]
    const { image, at } = parseShowClause(rest)
    const s: ShowStatement = { ...base, type: 'show', image, at }
    return s
  }

  // hide
  m = code.match(/^hide\s+([A-Za-z_][A-Za-z0-9_.]*)/)
  if (m) {
    const s: Statement = { ...base, type: 'hide' }
    return s
  }

  // jump
  m = code.match(/^jump\s+([A-Za-z_][A-Za-z0-9_.]*)/)
  if (m) {
    const s: JumpStatement = { ...base, type: 'jump', target: m[1] }
    return s
  }

  // call
  m = code.match(/^call\s+([A-Za-z_][A-Za-z0-9_.]*)/)
  if (m) {
    const s: CallStatement = { ...base, type: 'call', target: m[1] }
    return s
  }

  // return
  if (/^return\b/.test(code)) {
    return { ...base, type: 'return' }
  }

  // define（角色或其它变量）
  m = code.match(/^define\s+([A-Za-z_][A-Za-z0-9_.]*)\s*=/)
  if (m) {
    return { ...base, type: 'define' }
  }

  // default（变量声明：default name = value）
  m = code.match(/^default\s+([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.+)$/)
  if (m) {
    const s: DefaultStatement = { ...base, type: 'default', name: m[1], value: m[2].trim() }
    return s
  }

  // image
  m = code.match(/^image\s+(.+?)\s*=/)
  if (m) {
    return { ...base, type: 'image' }
  }

  // python 语句
  if (code.startsWith('$')) {
    return { ...base, type: 'python' }
  }

  // if / elif / else
  if (/^(if|elif)\s+.+:$/.test(code) || /^else\s*:/.test(code)) {
    return { ...base, type: 'if' }
  }

  // play / stop
  if (/^play\s+/.test(code)) return { ...base, type: 'play' }
  if (/^stop\s+/.test(code)) return { ...base, type: 'stop' }
  if (/^with\s+/.test(code)) return { ...base, type: 'with' }
  if (/^pause\b/.test(code)) return { ...base, type: 'pause' }
  if (/^window\s+/.test(code)) return { ...base, type: 'window' }

  // say：`角色 "对白"` 或裸字符串旁白
  const strings = extractStrings(code)
  if (strings.length > 0 && strings[0].start === 0) {
    // 裸字符串 = 旁白
    const s: SayStatement = { ...base, type: 'say', what: unquote(strings[0].value) }
    return s
  }
  const sayMatch = code.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(?=["'])/)
  if (sayMatch && !['if', 'elif', 'else', 'while', 'for'].includes(sayMatch[1])) {
    const str = extractStrings(code.slice(sayMatch[0].length))[0]
    if (str) {
      const s: SayStatement = {
        ...base,
        type: 'say',
        who: sayMatch[1],
        what: unquote(str.value)
      }
      return s
    }
  }

  // 其它未识别语句（screen/transform/style/init 等）
  return { ...base, type: 'other' }
}

/** 解析 `show/scene` 的图片标签与 at 变换，如 "eileen happy at left" */
function parseShowClause(rest: string): { image: string; at: string[] } {
  let at: string[] = []
  let image = rest.trim()

  const atIdx = rest.indexOf(' at ')
  if (atIdx >= 0) {
    image = rest.slice(0, atIdx).trim()
    const atPart = rest.slice(atIdx + 4).trim()
    // 去掉可能跟随的其它修饰（zorder/behind/as/with）
    at = atPart
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !/^(zorder|behind|as|with)\b/.test(s))
      .map((s) => s.split(/\s+/)[0])
  } else {
    // 可能没有 at，但 image 后可能跟 behind/as/zorder
    image = image
      .replace(/\s+(behind|as|zorder|with)\s+.*$/, '')
      .trim()
  }
  return { image, at }
}

// ---------- 主解析 ----------

export function parseRpyFile(path: string, source: string): RpyParseResult {
  const warnings: string[] = []
  const characters: CharacterDef[] = []
  const images: ImageDef[] = []
  const variables: DefaultStatement[] = []
  const edges: StoryEdge[] = []
  const labelBlocks: LabelBlock[] = []

  const lines = source.replace(/^﻿/, '').split(/\r?\n/)

  // label 栈（处理嵌套 label）
  const labelStack: { name: string; indent: number; block: LabelBlock }[] = []

  const currentLabel = (): LabelBlock | null =>
    labelStack.length > 0 ? labelStack[labelStack.length - 1].block : null

  function pushLabel(name: string, indent: number, lineNo: number): void {
    while (labelStack.length > 0 && labelStack[labelStack.length - 1].indent >= indent) {
      const done = labelStack.pop()!
      done.block.endLine = lineNo - 1
      labelBlocks.push(done.block)
    }
    const block: LabelBlock = { name, line: lineNo, endLine: lineNo, statements: [] }
    labelStack.push({ name, indent, block })
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const raw = lines[i]
    const code = stripComment(raw).trim()
    if (code === '') continue

    const indent = indentOf(raw)
    const stmt = classifyLine(raw, lineNo)
    if (!stmt) continue

    const label = currentLabel()
    if (label) label.statements.push(stmt)

    switch (stmt.type) {
      case 'label': {
        pushLabel((stmt as LabelStatement).name, indent, lineNo)
        break
      }
      case 'jump': {
        const t = (stmt as JumpStatement).target
        if (label) edges.push({ from: label.name, to: t, kind: 'jump', line: lineNo })
        break
      }
      case 'call': {
        const t = (stmt as CallStatement).target
        if (label) edges.push({ from: label.name, to: t, kind: 'call', line: lineNo })
        break
      }
      case 'menu': {
        // 解析紧随其后的选项（缩进更深的 "文本": 行）
        const menu = stmt as MenuStatement
        for (let j = i + 1; j < lines.length; j++) {
          const jraw = lines[j]
          const jcode = stripComment(jraw).trim()
          if (jcode === '') continue
          const jindent = indentOf(jraw)
          if (jindent <= indent) break
          // 选项行形如 "文本": 或 "文本" if cond:
          const cm = jcode.match(/^(["'])(.*?)\1\s*(?:if\s+.+)?:/)
          if (cm) {
            const choice: Choice = { text: unquote(cm[2]), line: j + 1 }
            // 寻找该选项块内的 jump/call 目标
            const choiceIndent = jindent
            for (let k = j + 1; k < lines.length; k++) {
              const kraw = lines[k]
              const kcode = stripComment(kraw).trim()
              if (kcode === '') continue
              const kindent = indentOf(kraw)
              if (kindent <= choiceIndent) break
              const jm = kcode.match(/^(jump|call)\s+([A-Za-z_][A-Za-z0-9_.]*)/)
              if (jm) {
                choice.target = jm[2]
                break
              }
            }
            menu.choices.push(choice)
            if (label && choice.target) {
              edges.push({
                from: label.name,
                to: choice.target,
                kind: 'choice',
                label: choice.text,
                line: choice.line
              })
            }
          }
        }
        break
      }
      case 'define': {
        const d = parseCharacterDef(raw)
        if (d) characters.push(d)
        break
      }
      case 'image': {
        const d = parseImageDef(raw)
        if (d) images.push(d)
        break
      }
      case 'default': {
        variables.push(stmt as DefaultStatement)
        break
      }
      default:
        break
    }
  }

  // 收尾剩余 label 栈
  while (labelStack.length > 0) {
    const done = labelStack.pop()!
    done.block.endLine = lines.length
    labelBlocks.push(done.block)
  }

  const labelMap = new Map<string, LabelBlock>()
  for (const lb of labelBlocks) labelMap.set(lb.name, lb)

  return { path, labels: labelBlocks, characters, images, variables, labelMap, edges, warnings }
}

/** 解析 define 角色语句 */
function parseCharacterDef(raw: string): CharacterDef | null {
  const code = stripComment(raw).trim()
  const m = code.match(/^define\s+([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*Character\(/)
  if (!m) return null
  const name = m[1]
  const openParen = code.indexOf('(', code.indexOf('Character'))
  const firstStr = extractStrings(code.slice(openParen))[0]
  const displayName = firstStr ? unquote(firstStr.value) : name
  const colorMatch = code.match(/color\s*=\s*["']([^"']*)["']/)
  return {
    name,
    displayName,
    color: colorMatch ? colorMatch[1] : undefined,
    line: 0
  }
}

/** 解析 image 定义语句 */
function parseImageDef(raw: string): ImageDef | null {
  const code = stripComment(raw).trim()
  const m = code.match(/^image\s+(.+?)\s*=\s*(.+)$/)
  if (!m) return null
  const tag = m[1].trim()
  const rhs = m[2].trim()
  const parts = tag.split(/\s+/)
  const baseTag = parts[0]
  const attrs = parts.slice(1)
  // 右侧若是简单字符串则作为文件
  const fileStr = extractStrings(rhs)[0]
  const file = fileStr && rhs.trim().startsWith('"') ? unquote(fileStr.value) : null
  return { name: tag, tag, baseTag, attrs, file, line: 0 }
}

// ---------- 项目级聚合 ----------

export interface ParsedFileEntry {
  path: string
  source: string
}

export function parseProject(files: ParsedFileEntry[]): ProjectParseResult {
  const labelToFile: Record<string, string> = {}
  const labels: LabelBlock[] = []
  const characters: CharacterDef[] = []
  const images: ImageDef[] = []
  const variables: DefaultStatement[] = []
  const edges: StoryEdge[] = []
  const warnings: string[] = []

  for (const f of files) {
    const r = parseRpyFile(f.path, f.source)
    for (const lb of r.labels) {
      labels.push(lb)
      labelToFile[lb.name] = f.path
    }
    characters.push(...r.characters)
    images.push(...r.images)
    variables.push(...r.variables)
    edges.push(...r.edges)
    warnings.push(...r.warnings)
  }

  return { labelToFile, labels, characters, images, variables, edges, warnings }
}
