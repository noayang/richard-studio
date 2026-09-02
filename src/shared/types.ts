// ============================================================
// 共享类型定义 —— 同时被 main 进程 (fs IPC) 和 renderer (parser/UI) 使用
// ============================================================

/** 项目文件系统中的一个文件/目录节点 */
export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

/** 打开项目时返回的项目概览 */
export interface ProjectInfo {
  rootPath: string
  name: string
  tree: FileNode[]
  /** 所有 .rpy 文件的绝对路径 */
  scriptFiles: string[]
}

/** 角色定义：define e = Character("Eileen") */
export interface CharacterDef {
  name: string
  /** 显示名，如 "Eileen" */
  displayName: string
  /** 角色名颜色，若定义里指定了 who_color */
  color?: string
  line: number
}

/** 图片定义：image bg park = "park.png" / image eileen happy = "eileen_happy.png" */
export interface ImageDef {
  name: string
  /** 组合后的完整图片标签，如 "bg park"、"eileen happy" */
  tag: string
  /** 基础标签（不含属性），如 "bg"、"eileen" */
  baseTag: string
  /** 属性部分，如 "happy" */
  attrs: string[]
  /** 引用的文件路径字符串（可能为 null，例如用于 Solid/Transform 等） */
  file: string | null
  line: number
}

/** 通用语句基类 */
export interface Statement {
  type:
    | 'say'
    | 'scene'
    | 'show'
    | 'hide'
    | 'jump'
    | 'call'
    | 'menu'
    | 'label'
    | 'define'
    | 'default'
    | 'image'
    | 'return'
    | 'python'
    | 'if'
    | 'play'
    | 'stop'
    | 'with'
    | 'pause'
    | 'window'
    | 'other'
  /** 在源文件中的 1-based 行号 */
  line: number
  /** 原始文本（去除缩进） */
  raw: string
  /** 缩进层级 */
  indent: number
}

export interface SayStatement extends Statement {
  type: 'say'
  /** 说话者变量名（无则为旁白） */
  who?: string
  /** 说话者显示名 */
  whoDisplay?: string
  /** 对话内容 */
  what: string
}

export interface ShowStatement extends Statement {
  type: 'show'
  /** 图片标签，如 "eileen happy" */
  image: string
  /** at 变换 */
  at: string[]
}

export interface SceneStatement extends Statement {
  type: 'scene'
  image: string
  at: string[]
}

/** 变量声明：default name = value */
export interface DefaultStatement extends Statement {
  type: 'default'
  name: string
  value: string
}

export interface JumpStatement extends Statement {
  type: 'jump'
  /** 目标 label */
  target: string
}

export interface CallStatement extends Statement {
  type: 'call'
  target: string
}

export interface Choice {
  /** 选项文本 */
  text: string
  /** 选项所在行 */
  line: number
  /** jump/call 目标 label（可能为空，例如 fallthrough 到内联 block） */
  target?: string
}

export interface MenuStatement extends Statement {
  type: 'menu'
  choices: Choice[]
}

export interface LabelStatement extends Statement {
  type: 'label'
  name: string
}

/** 一个 label 块：从 `label xxx:` 到下一个同级 label 或文件结束 */
export interface LabelBlock {
  name: string
  line: number
  /** 结束行（包含） */
  endLine: number
  statements: Statement[]
}

/** 剧情图中连接两个 label 的边 */
export interface StoryEdge {
  from: string
  to: string
  kind: 'jump' | 'call' | 'choice'
  /** 若为 choice，则是选项文本 */
  label?: string
  line: number
}

/** 单个 .rpy 文件解析结果 */
export interface RpyParseResult {
  path: string
  labels: LabelBlock[]
  characters: CharacterDef[]
  images: ImageDef[]
  /** 变量声明（default name = value） */
  variables: DefaultStatement[]
  /** label -> 名字的映射，用于快速查找 */
  labelMap: Map<string, LabelBlock>
  /** 剧情图边（跨文件时会带文件前缀由调用方处理） */
  edges: StoryEdge[]
  /** 解析过程中产生的警告 */
  warnings: string[]
}

/** 整个项目解析后的聚合结果 */
export interface ProjectParseResult {
  /** label 全名 -> 定义文件路径 */
  labelToFile: Record<string, string>
  /** 所有 label */
  labels: LabelBlock[]
  characters: CharacterDef[]
  images: ImageDef[]
  variables: DefaultStatement[]
  edges: StoryEdge[]
  warnings: string[]
}

// ============================================================
// IPC 通道与 payload 类型
// ============================================================

export interface IpcApi {
  openProject(): Promise<ProjectInfo | null>
  openProjectAt(path: string): Promise<ProjectInfo | null>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  /** 删除文件或目录（递归） */
  deletePath(path: string): Promise<void>
  listDir(path: string): Promise<FileNode[]>
  /** 读取一张图片为 data URL，供场景搭建器预览 */
  readImage(path: string): Promise<string | null>
  /** 弹窗选择图片文件，返回 data URL 列表 */
  pickImages(): Promise<{ path: string; name: string; dataUrl: string }[]>
  /** 在项目 image 目录中查找图片 */
  findImageFiles(projectRoot: string): Promise<string[]>
  getRenpyPath(): Promise<string | null>
  revealInExplorer(path: string): Promise<void>
  /** 打开一个新项目时，重新扫描 */
  onProjectOpened(cb: (info: ProjectInfo) => void): () => void
  /** 选择/设置项目资源根目录（素材会被复制到这里） */
  chooseProjectDir(): Promise<string | null>
  getProjectDir(): Promise<string | null>
  /** 选择并复制素材到项目文件夹，按类别归档，返回落盘结果 */
  importAssets(category: string): Promise<ImportedAsset[]>
  /** 从项目文件夹扫描已归档的素材，用于重启后恢复资产列表 */
  listAssets(): Promise<ArchivedAsset[]>
  /** 项目列表（含失效标记） */
  listProjects(): Promise<ProjectEntry[]>
  /** 选择目录加入项目列表（不新建，仅登记已有 Ren'Py 项目） */
  addProject(): Promise<ProjectEntry | null>
  /** 在 parentDir 下新建一个项目目录结构 */
  createProject(parentDir: string, name: string): Promise<ProjectEntry | null>
  /** 从项目列表移除一条记录（可顺带删除失效目录） */
  removeProject(path: string): Promise<ProjectEntry[]>
  /** 加载项目：读取 game/*.rpy 内容返回给 renderer 解析 */
  loadProject(path: string): Promise<{ path: string; name: string; files: ProjectScriptFile[] } | null>
  /** 通用目录选择（新建项目选父目录用） */
  chooseDirectory(title?: string): Promise<string | null>
  /** 弹窗选择素材文件（直接浏览项目目录，不复制），返回文件路径 + 预览 */
  pickAsset(kind: 'image' | 'audio' | 'video' | 'font' | 'any'): Promise<PickedAsset | null>
}

/** 从文件选择器选回的一个素材文件 */
export interface PickedAsset {
  /** 文件绝对路径 */
  path: string
  /** 文件名 */
  name: string
  /** 相对项目根目录的路径（文件在项目内时） */
  relativePath: string
  /** 图片/字体的 data URL（用于即时预览） */
  dataUrl?: string
}

export type AssetImportCategory =
  | 'background'
  | 'character'
  | 'cg'
  | 'particle'
  | 'bgm'
  | 'se'
  | 'voice'
  | 'video'
  | 'font'

export interface ImportedAsset {
  /** 源文件绝对路径（复制前） */
  path: string
  /** 文件名 */
  name: string
  /** 相对项目根目录的落盘路径，如 assets/backgrounds/xxx.png */
  relativePath: string
  /** 图片类的 data URL 预览 */
  dataUrl?: string
}

/** 从项目文件夹扫描回来的已归档资产 */
export interface ArchivedAsset {
  name: string
  relativePath: string
  category: string
  dataUrl?: string
}

/** 项目列表中的一条记录 */
export interface ProjectEntry {
  /** 项目根目录绝对路径（含 game/ 子目录） */
  path: string
  name: string
  /** 该路径当前是否仍存在（失效项目可删除） */
  valid: boolean
}

/** 新建/打开一个项目后返回的结果：脚本文件内容，交给 renderer 解析 */
export interface ProjectScriptFile {
  path: string
  content: string
}
