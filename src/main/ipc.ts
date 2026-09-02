import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import { promises as fs } from 'fs'
import { join, basename, extname } from 'path'
import type { FileNode, ProjectInfo, ProjectEntry, ProjectScriptFile, PickedAsset } from '../shared/types'

let mainWindow: BrowserWindow | null = null
export function setMainWindow(w: BrowserWindow): void {
  mainWindow = w
}

// ---------- 工具 ----------

const RPY_EXT = '.rpy'
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'])

// 素材类别 → 归档子目录 + 可接受的文件扩展名 + 是否图片（用于生成预览）
const CATEGORY_META: Record<string, { folder: string; exts: string[]; image?: boolean }> = {
  background: { folder: 'backgrounds', exts: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'], image: true },
  character: { folder: 'characters', exts: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'], image: true },
  cg: { folder: 'cgs', exts: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'], image: true },
  particle: { folder: 'particles', exts: ['png', 'webp'], image: true },
  bgm: { folder: 'bgm', exts: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] },
  se: { folder: 'se', exts: ['mp3', 'wav', 'ogg', 'm4a'] },
  voice: { folder: 'voice', exts: ['mp3', 'wav', 'ogg', 'm4a'] },
  video: { folder: 'video', exts: ['mp4', 'webm', 'mov', 'avi', 'mkv'] },
  font: { folder: 'fonts', exts: ['ttf', 'otf', 'woff', 'woff2'] },
  other: { folder: 'other', exts: [] }
}

let projectDir = ''

/** 持久化配置：当前项目目录 + 项目列表 */
interface StudioConfig {
  projectDir: string
  projects: { path: string; name: string }[]
}

let projects: { path: string; name: string }[] = []

function configPath(): string {
  return join(app.getPath('userData'), 'renpy-studio-config.json')
}

async function loadConfig(): Promise<void> {
  try {
    const data = JSON.parse(await fs.readFile(configPath(), 'utf-8')) as Partial<StudioConfig>
    if (typeof data.projectDir === 'string') projectDir = data.projectDir
    if (Array.isArray(data.projects)) projects = data.projects
  } catch {
    /* 首次运行无配置 */
  }
}

async function saveConfig(): Promise<void> {
  try {
    await fs.writeFile(configPath(), JSON.stringify({ projectDir, projects } as StudioConfig), 'utf-8')
  } catch {
    /* 忽略持久化失败 */
  }
}

/** 复制源文件到项目 assets 目录，重名自动追加序号 */
async function copyIntoAssets(category: string, srcPath: string): Promise<{ relativePath: string; absPath: string }> {
  const meta = CATEGORY_META[category]
  const dir = join(projectDir, 'assets', meta.folder)
  await fs.mkdir(dir, { recursive: true })
  const name = basename(srcPath)
  const ext = extname(name)
  const base = name.slice(0, name.length - ext.length)
  let target = join(dir, name)
  let i = 1
  while (true) {
    try {
      await fs.access(target)
      target = join(dir, `${base}_${i}${ext}`)
      i += 1
    } catch {
      break
    }
  }
  await fs.copyFile(srcPath, target)
  return { relativePath: join('assets', meta.folder, basename(target)), absPath: target }
}

/** 判断目录是否为 Ren'Py 项目根（包含 game/ 目录） */
async function isRenpyProject(dir: string): Promise<boolean> {
  try {
    const st = await fs.stat(join(dir, 'game'))
    return st.isDirectory()
  } catch {
    return false
  }
}

/** 递归扫描目录，构建 FileNode 树；跳过常见无关目录 */
async function buildTree(dir: string, depth = 0): Promise<FileNode[]> {
  if (depth > 6) return []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const SKIP = new Set(['.git', '.svn', 'cache', '__pycache__', 'save', '.venv', 'node_modules'])
  const nodes: FileNode[] = []

  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const children = await buildTree(full, depth + 1)
      nodes.push({ name: entry.name, path: full, isDirectory: true, children })
    } else if (entry.isFile()) {
      nodes.push({ name: entry.name, path: full, isDirectory: false })
    }
  }

  // 目录在前，文件在后，各自按名称排序
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return nodes
}

async function collectScriptFiles(root: string): Promise<string[]> {
  const gameDir = join(root, 'game')
  const result: string[] = []
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (extname(entry.name).toLowerCase() === RPY_EXT) {
        result.push(full)
      }
    }
  }
  await walk(gameDir)
  result.sort()
  return result
}

/** 扫描项目根，返回 ProjectInfo */
async function scanProject(root: string): Promise<ProjectInfo | null> {
  if (!(await isRenpyProject(root))) return null
  const tree = await buildTree(root)
  const scriptFiles = await collectScriptFiles(root)
  return {
    rootPath: root,
    name: basename(root),
    tree,
    scriptFiles
  }
}

// ---------- 图片 ----------

/** 把图片文件名转为 Ren'Py 隐式图片标签：bg_park.png -> "bg park" */
function filenameToTag(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '')
  // Ren'Py 约定：下划线分隔 tag 与 attribute，连字符原样保留
  return base.replace(/_/g, ' ')
}

/** 递归收集项目 game 目录下所有图片文件，返回 {path, tag} */
async function findImages(root: string): Promise<{ path: string; tag: string }[]> {
  const gameDir = join(root, 'game')
  const result: { path: string; tag: string }[] = []
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (IMAGE_EXTS.has(extname(entry.name).toLowerCase())) {
        result.push({ path: full, tag: filenameToTag(entry.name) })
      }
    }
  }
  await walk(gameDir)
  return result
}

/** 读取图片为 data URL */
async function readImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(path)
    const ext = extname(path).toLowerCase().slice(1)
    const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext
    return `data:image/${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

// ---------- 注册 ----------

export function registerIpcHandlers(): void {
  void loadConfig()

  ipcMain.handle('project:open', async (): Promise<ProjectInfo | null> => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: '选择 Ren\'Py 项目文件夹',
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const root = res.filePaths[0]
    const info = await scanProject(root)
    if (!info) {
      await dialog.showErrorBox(
        '不是有效的 Ren\'Py 项目',
        `所选目录下没有找到 game 文件夹：\n${root}`
      )
      return null
    }
    return info
  })

  ipcMain.handle('project:openAt', async (_e, path: string): Promise<ProjectInfo | null> => {
    return scanProject(path)
  })

  ipcMain.handle('project:readFile', async (_e, path: string): Promise<string> => {
    return fs.readFile(path, 'utf-8')
  })

  ipcMain.handle('project:writeFile', async (_e, path: string, content: string): Promise<void> => {
    await fs.writeFile(path, content, 'utf-8')
  })

  ipcMain.handle('project:listDir', async (_e, path: string): Promise<FileNode[]> => {
    return buildTree(path, 0)
  })

  ipcMain.handle('project:findImages', async (_e, root: string) => {
    return findImages(root)
  })

  ipcMain.handle('project:readImage', async (_e, path: string): Promise<string | null> => {
    return readImageAsDataUrl(path)
  })

  // 选择图片文件，返回 {path, name, dataUrl}[]
  ipcMain.handle('assets:pickImages', async (): Promise<{ path: string; name: string; dataUrl: string }[]> => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: '导入图片素材',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] }]
    })
    if (res.canceled) return []
    const out: { path: string; name: string; dataUrl: string }[] = []
    for (const p of res.filePaths) {
      const dataUrl = await readImageAsDataUrl(p)
      if (dataUrl) out.push({ path: p, name: basename(p), dataUrl })
    }
    return out
  })

  ipcMain.handle('project:reveal', async (_e, path: string): Promise<void> => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle('project:rename', async (_e, oldPath: string, newName: string) => {
    const dir = join(oldPath, '..')
    const newPath = join(dir, newName)
    await fs.rename(oldPath, newPath)
    return newPath
  })

  ipcMain.handle('project:createFile', async (_e, dir: string, name: string) => {
    const full = join(dir, name)
    await fs.writeFile(full, '', { flag: 'wx' })
    return full
  })

  ipcMain.handle('project:createDir', async (_e, dir: string, name: string) => {
    const full = join(dir, name)
    await fs.mkdir(full)
    return full
  })

  ipcMain.handle('project:delete', async (_e, path: string) => {
    const st = await fs.stat(path)
    if (st.isDirectory()) {
      await fs.rm(path, { recursive: true, force: true })
    } else {
      await fs.unlink(path)
    }
  })

  // ---- 素材导入：复制进项目文件夹并归档 ----

  ipcMain.handle('assets:chooseDir', async (): Promise<string | null> => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: '选择项目资源根目录（素材会复制到这里）',
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    projectDir = res.filePaths[0]
    await saveConfig()
    return projectDir
  })

  ipcMain.handle('assets:getDir', async (): Promise<string | null> => {
    return projectDir || null
  })

  ipcMain.handle('assets:import', async (_e, category: string): Promise<{ path: string; name: string; relativePath: string; dataUrl?: string }[]> => {
    if (!projectDir) {
      await dialog.showErrorBox('未设置项目目录', '请先点击「选择项目文件夹」设置资源根目录。')
      return []
    }
    const meta = CATEGORY_META[category]
    if (!meta) return []
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: `导入${category}素材`,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: meta.folder, extensions: meta.exts }]
    })
    if (res.canceled) return []
    const out: { path: string; name: string; relativePath: string; dataUrl?: string }[] = []
    for (const src of res.filePaths) {
      try {
        const { relativePath, absPath } = await copyIntoAssets(category, src)
        const item: { path: string; name: string; relativePath: string; dataUrl?: string } = { path: src, name: basename(src), relativePath }
        if (meta.image) {
          const dataUrl = await readImageAsDataUrl(absPath)
          if (dataUrl) item.dataUrl = dataUrl
        }
        out.push(item)
      } catch (err) {
        console.error('[assets:import] 复制失败', src, err)
      }
    }
    return out
  })

  // 扫描项目 assets 目录，返回已归档素材（重启后恢复资产列表）
  ipcMain.handle('assets:list', async (): Promise<{ name: string; relativePath: string; category: string; dataUrl?: string }[]> => {
    if (!projectDir) return []
    const out: { name: string; relativePath: string; category: string; dataUrl?: string }[] = []
    for (const [category, meta] of Object.entries(CATEGORY_META)) {
      const dir = join(projectDir, 'assets', meta.folder)
      let entries
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const e of entries) {
        if (!e.isFile()) continue
        const item: { name: string; relativePath: string; category: string; dataUrl?: string } = {
          name: e.name,
          relativePath: join('assets', meta.folder, e.name),
          category
        }
        if (meta.image) {
          const dataUrl = await readImageAsDataUrl(join(dir, e.name))
          if (dataUrl) item.dataUrl = dataUrl
        }
        out.push(item)
      }
    }
    return out
  })

  // ---- 素材选择：直接浏览项目目录，不复制 ----

  const PICK_EXTS: Record<string, string[]> = {
    image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg'],
    audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac'],
    video: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
    font: ['ttf', 'otf', 'woff', 'woff2'],
    any: []
  }

  /** 读取文件为 data URL（图片/字体预览用） */
  async function readFileAsDataUrl(path: string, mime: string): Promise<string | null> {
    try {
      const buf = await fs.readFile(path)
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  }

  ipcMain.handle('assets:pick', async (_e, kind: string): Promise<PickedAsset | null> => {
    const exts = PICK_EXTS[kind] ?? []
    // 默认浏览到当前项目的 game 目录（Ren'Py 素材都放在这里）
    let defaultPath: string | undefined
    if (projectDir) {
      defaultPath = join(projectDir, 'game')
    }
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: '选择素材文件',
      properties: ['openFile'],
      defaultPath,
      filters: exts.length ? [{ name: kind, extensions: exts }] : []
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const path = res.filePaths[0]
    const name = basename(path)
    let relativePath = ''
    if (projectDir) {
      const norm = path.replace(/\\/g, '/')
      const root = projectDir.replace(/\\/g, '/')
      if (norm.startsWith(root)) relativePath = norm.slice(root.length).replace(/^\//, '')
    }
    let dataUrl: string | undefined
    if (kind === 'image') {
      const d = await readImageAsDataUrl(path)
      if (d) dataUrl = d
    } else if (kind === 'font') {
      const ext = extname(path).toLowerCase().slice(1)
      const mime = ext === 'otf' ? 'font/otf' : ext === 'woff' ? 'font/woff' : ext === 'woff2' ? 'font/woff2' : 'font/ttf'
      const d = await readFileAsDataUrl(path, mime)
      if (d) dataUrl = d
    }
    return { path, name, relativePath, dataUrl }
  })

  // 用于查找 renpy 可执行文件（供未来“运行游戏”按钮使用）
  ipcMain.handle('renpy:findExe', async (): Promise<string | null> => {
    const candidates = [
      'D:/renpy-8.5.3-sdk/renpy-8.5.3-sdk/renpy.exe',
      'C:/renpy/renpy.exe'
    ]
    for (const c of candidates) {
      try {
        await fs.access(c)
        return c
      } catch {
        /* 继续 */
      }
    }
    return null
  })

  // ---- 项目列表管理 ----

  /** 判断目录是否为有效 Ren'Py 项目（存在 game/ 目录） */
  async function isValidProject(dir: string): Promise<boolean> {
    try {
      const st = await fs.stat(join(dir, 'game'))
      return st.isDirectory()
    } catch {
      return false
    }
  }

  ipcMain.handle('dialog:chooseDir', async (_e, title?: string): Promise<string | null> => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: title ?? '选择目录',
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle('projects:list', async (): Promise<ProjectEntry[]> => {
    const out: ProjectEntry[] = []
    for (const p of projects) {
      out.push({ path: p.path, name: p.name, valid: await isValidProject(p.path) })
    }
    return out
  })

  ipcMain.handle('projects:add', async (): Promise<ProjectEntry | null> => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: '选择已有的 Ren\'Py 项目文件夹',
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const path = res.filePaths[0]
    if (!(await isValidProject(path))) {
      await dialog.showErrorBox('不是有效的 Ren\'Py 项目', `所选目录下没有 game 文件夹：\n${path}`)
      return null
    }
    if (!projects.some((p) => p.path === path)) {
      projects.push({ path, name: basename(path) })
      await saveConfig()
    }
    return { path, name: basename(path), valid: true }
  })

  ipcMain.handle('projects:create', async (_e, parentDir: string, name: string): Promise<ProjectEntry | null> => {
    const safe = (name || '').trim()
    if (!safe || /[\\/:*?"<>|]/.test(safe)) {
      await dialog.showErrorBox('名称不合法', '项目名不能为空，且不能包含 \\ / : * ? " < > | 等字符。')
      return null
    }
    const root = join(parentDir, safe)
    try {
      await fs.mkdir(join(root, 'game'), { recursive: true })
      await fs.writeFile(join(root, 'game', 'script.rpy'), 'label start:\n    show screen hud\n    "欢迎来到这个项目。"\n    return\n', 'utf-8')
      await fs.writeFile(join(root, 'game', 'options.rpy'), '## 由 Richard Studio 创建\n', 'utf-8')
      // 资产归档目录结构
      for (const meta of Object.values(CATEGORY_META)) {
        await fs.mkdir(join(root, 'assets', meta.folder), { recursive: true })
      }
    } catch (err) {
      await dialog.showErrorBox('创建失败', String(err))
      return null
    }
    projects.push({ path: root, name: safe })
    await saveConfig()
    return { path: root, name: safe, valid: true }
  })

  ipcMain.handle('projects:remove', async (_e, path: string): Promise<ProjectEntry[]> => {
    projects = projects.filter((p) => p.path !== path)
    await saveConfig()
    if (projectDir === path) projectDir = ''
    const out: ProjectEntry[] = []
    for (const p of projects) out.push({ path: p.path, name: p.name, valid: await isValidProject(p.path) })
    return out
  })

  ipcMain.handle('projects:open', async (_e, path: string): Promise<{ path: string; name: string; files: ProjectScriptFile[] } | null> => {
    if (!(await isValidProject(path))) return null
    const gameDir = join(path, 'game')
    const files = await collectScriptFiles(path)
    const out: ProjectScriptFile[] = []
    for (const f of files) {
      try {
        out.push({ path: f, content: await fs.readFile(f, 'utf-8') })
      } catch {
        /* 跳过不可读文件 */
      }
    }
    projectDir = path
    if (!projects.some((p) => p.path === path)) projects.push({ path, name: basename(path) })
    await saveConfig()
    return { path, name: basename(path), files: out }
  })
}
