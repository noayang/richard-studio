// ============================================================
// 数据模型 —— 对齐参考工具 Studio 的 JSON 结构
// UI 元素 / 脚本块 / 角色 / 场景 / 资产 / 成就 / 辞典
// ============================================================

// ---------- 通用 ----------
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type Anchor = 'tl' | 'tc' | 'tr' | 'cl' | 'c' | 'cr' | 'bl' | 'bc' | 'br'

// ---------- UI 元素 ----------
export type ElementType =
  | 'rect'
  | 'line'
  | 'background-mask'
  | 'text'
  | 'paragraph'
  | 'dialogue-backdrop'
  | 'dialogue-frame'
  | 'dialogue-text'
  | 'dialogue-name'
  | 'dialogue-wait-cursor'
  | 'button'
  | 'slider'
  | 'switch'
  | 'select'
  | 'tabs'
  | 'toolbar'
  | 'history-list'
  | 'save-grid'
  | 'cg-gallery'
  | 'music-gallery'
  | 'fragment-gallery'
  | 'message-box'
  | 'input-dialog'
  | 'choice-list'
  | 'choice-item'
  | 'choice-text'
  | 'choice-number'
  | 'choice-indicator'
  | 'image'
  | 'dictionary-popup'
  | 'achievement-list'
  | 'variable-panel'
  | 'variable-value'
  | 'shop-list'
  | 'date-display'
  | 'newspaper-button'
  | 'newspaper-panel'
  | 'world-map'

export interface UiStyle {
  fill?: string
  /** 用图片替换填充色/背景（按钮图片、背景图等） */
  fillImage?: string
  borderColor?: string
  borderWidth?: number
  radius?: number
  opacity?: number
  color?: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  letterSpacing?: number
  lineHeight?: number
  textAlign?: 'left' | 'center' | 'right'
  backdropBlur?: number
  customCss?: string
}

export interface UiAnimation {
  enter?: { preset: string; durationMs: number; delayMs: number }
  exit?: { preset: string; durationMs: number; delayMs: number }
}

export interface UiElement {
  id: string
  refId: string
  type: ElementType
  name: string
  rect: Rect
  anchor: Anchor
  style: UiStyle
  props: Record<string, unknown>
  animation?: UiAnimation
  events?: Record<string, unknown>
  /** 分组 id：同组元素锁定成组一起移动 */
  groupId?: string
}

export interface UiScreen {
  version: number
  name: string
  canvas: { width: number; height: number }
  elements: UiElement[]
  /** 渲染层级：越小越靠后。对话框 say 用 100，立绘在 master 层（≈0），变量 HUD 用 50 垫在两者之间 */
  zorder?: number
  dialogueBehavior?: { text_speed: number }
  /** 界面背景填充图片（垫在所有元素最底层，铺满整个游戏窗口，仅编辑器参考、不导出） */
  backgroundImage?: string
}

// ---------- 元素类型目录（右键插入菜单用） ----------
export interface ElementTypeDef {
  type: ElementType
  label: string
  category: string
  defaultName: string
  defaultStyle: UiStyle
  defaultProps: Record<string, unknown>
  defaultSize: { w: number; h: number }
}

export const ELEMENT_CATALOG: ElementTypeDef[] = [
  { type: 'rect', label: '矩形', category: '布局', defaultName: '矩形', defaultStyle: { fill: 'rgba(255,255,255,0.06)', radius: 8, opacity: 100 }, defaultProps: {}, defaultSize: { w: 200, h: 120 } },
  { type: 'line', label: '线条', category: '布局', defaultName: '线条', defaultStyle: { fill: '#ffffff', opacity: 100 }, defaultProps: {}, defaultSize: { w: 200, h: 2 } },
  { type: 'background-mask', label: '遮罩', category: '布局', defaultName: '遮罩', defaultStyle: { fill: 'rgba(8,13,20,0.88)', radius: 0, backdropBlur: 0, opacity: 100 }, defaultProps: {}, defaultSize: { w: 1920, h: 1080 } },
  { type: 'text', label: '文本', category: '文本', defaultName: '文本', defaultStyle: { color: '#e8edf2', fontSize: 32, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", textAlign: 'center', opacity: 100 }, defaultProps: { text: '文本内容' }, defaultSize: { w: 400, h: 60 } },
  { type: 'paragraph', label: '段落', category: '文本', defaultName: '段落', defaultStyle: { color: '#e8edf2', fontSize: 28, lineHeight: 1.75, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", textAlign: 'center', opacity: 100 }, defaultProps: { text: '段落内容' }, defaultSize: { w: 600, h: 200 } },
  { type: 'dialogue-backdrop', label: '舞台遮罩', category: '对话框', defaultName: '舞台遮罩', defaultStyle: { fill: '#000000', opacity: 0 }, defaultProps: {}, defaultSize: { w: 1920, h: 1080 } },
  { type: 'dialogue-frame', label: '框体背景', category: '对话框', defaultName: '框体背景', defaultStyle: { fill: 'transparent', borderColor: 'transparent', borderWidth: 0, radius: 0, opacity: 100 }, defaultProps: { linearGradient: { enabled: true, angle: 0, startColor: 'rgba(0,0,0,0.75)', endColor: 'rgba(0,0,0,0.3)' } }, defaultSize: { w: 640, h: 1080 } },
  { type: 'dialogue-text', label: '对白文本', category: '对话框', defaultName: '对白文本', defaultStyle: { color: '#f3ede2', fontSize: 30, fontWeight: 500, letterSpacing: 1.2, textAlign: 'left', lineHeight: 1.75, opacity: 100 }, defaultProps: { previewText: '有些故事，会从一个看似普通的夜晚开始。\n而我们，刚好站在它的入口。' }, defaultSize: { w: 500, h: 300 } },
  { type: 'dialogue-name', label: '角色名', category: '对话框', defaultName: '角色名', defaultStyle: { color: '#ffd88a', fontSize: 34, fontWeight: 600, letterSpacing: 1.36, textAlign: 'left', opacity: 100 }, defaultProps: { previewName: '角色' }, defaultSize: { w: 240, h: 44 } },
  { type: 'dialogue-wait-cursor', label: '等待提示', category: '对话框', defaultName: '等待提示', defaultStyle: { color: '#ffffff', opacity: 100 }, defaultProps: { shape: 'diamond', animation: 'rotate', durationMs: 1000 }, defaultSize: { w: 28, h: 28 } },
  { type: 'history-list', label: '历史记录', category: '对话框', defaultName: '历史记录', defaultStyle: { color: '#e8edf2', fontSize: 22, fill: 'rgba(9,16,24,0.58)', borderColor: 'rgba(127,212,200,0.22)', borderWidth: 1, radius: 18, opacity: 100 }, defaultProps: { maxEntries: 200, gap: 12, showSpeaker: true, showVoiceButton: true, showTimeline: true, emptyText: '还没有可以回看的对话', accentColor: '#7fd4c8' }, defaultSize: { w: 600, h: 800 } },
  { type: 'image', label: '图片', category: '布局', defaultName: '图片', defaultStyle: { opacity: 100 }, defaultProps: { src: '' }, defaultSize: { w: 300, h: 300 } },
  { type: 'button', label: '按钮', category: '交互', defaultName: '按钮', defaultStyle: { color: '#dce8f2', fill: 'rgba(120,150,180,0.06)', borderColor: 'rgba(150,180,210,0.14)', borderWidth: 1, radius: 12, fontSize: 22, opacity: 100 }, defaultProps: { text: '按钮' }, defaultSize: { w: 200, h: 52 } },
  { type: 'slider', label: '滑块', category: '交互', defaultName: '滑块', defaultStyle: { color: '#7fd4c8', opacity: 100 }, defaultProps: { min: 0, max: 100, value: 50 }, defaultSize: { w: 320, h: 24 } },
  { type: 'switch', label: '开关', category: '交互', defaultName: '开关', defaultStyle: { color: '#7fd4c8', opacity: 100 }, defaultProps: { label: '', value: true }, defaultSize: { w: 80, h: 40 } },
  { type: 'choice-list', label: '选项列表', category: '选项', defaultName: '选项列表', defaultStyle: { color: '#e8edf2', fontSize: 28, opacity: 100 }, defaultProps: { choices: ['选项一', '选项二', '选项三'] }, defaultSize: { w: 600, h: 300 } },
  { type: 'choice-text', label: '选项文本', category: '选项', defaultName: '选项文本', defaultStyle: { color: '#e8edf2', fontSize: 28, textAlign: 'left', opacity: 100 }, defaultProps: { text: '选项文本' }, defaultSize: { w: 300, h: 60 } },
  { type: 'choice-indicator', label: '选项指示器', category: '选项', defaultName: '选项指示器', defaultStyle: { color: '#7fd4c8', opacity: 100 }, defaultProps: { shape: 'diamond' }, defaultSize: { w: 24, h: 24 } },
  { type: 'toolbar', label: '工具栏', category: '交互', defaultName: '工具栏', defaultStyle: { fill: 'rgba(9,16,24,0.6)', opacity: 100 }, defaultProps: {}, defaultSize: { w: 1920, h: 60 } },
  { type: 'save-grid', label: '存档格', category: '系统', defaultName: '存档格', defaultStyle: { fill: 'rgba(9,16,24,0.58)', borderColor: 'rgba(127,212,200,0.22)', borderWidth: 1, radius: 18, opacity: 100 }, defaultProps: {}, defaultSize: { w: 400, h: 220 } },
  { type: 'cg-gallery', label: 'CG 画廊', category: '系统', defaultName: 'CG画廊', defaultStyle: { color: '#e8edf2', opacity: 100 }, defaultProps: {}, defaultSize: { w: 800, h: 600 } },
  { type: 'music-gallery', label: '音乐画廊', category: '系统', defaultName: '音乐画廊', defaultStyle: { color: '#e8edf2', opacity: 100 }, defaultProps: {}, defaultSize: { w: 800, h: 600 } },
  { type: 'fragment-gallery', label: '片段画廊', category: '系统', defaultName: '片段画廊', defaultStyle: { color: '#e8edf2', opacity: 100 }, defaultProps: {}, defaultSize: { w: 800, h: 600 } },
  { type: 'message-box', label: '消息框', category: '系统', defaultName: '消息框', defaultStyle: { color: '#e8edf2', fill: 'rgba(9,16,24,0.7)', radius: 12, opacity: 100 }, defaultProps: { text: '提示信息' }, defaultSize: { w: 400, h: 160 } },
  { type: 'dictionary-popup', label: '辞典弹窗', category: '系统', defaultName: '辞典弹窗', defaultStyle: { color: '#e8edf2', fill: 'rgba(9,16,24,0.92)', radius: 16, opacity: 100 }, defaultProps: {}, defaultSize: { w: 720, h: 480 } },
  { type: 'achievement-list', label: '成就列表', category: '系统', defaultName: '成就列表', defaultStyle: { color: '#e8edf2', fill: 'rgba(9,16,24,0.58)', borderColor: 'rgba(255,216,138,0.22)', borderWidth: 1, radius: 18, opacity: 100 }, defaultProps: { cols: 4, gap: 20, emptyText: '尚未解锁任何成就' }, defaultSize: { w: 1320, h: 720 } },
  { type: 'variable-panel', label: '变量面板', category: '系统', defaultName: '变量面板', defaultStyle: { color: '#e8edf2', fill: 'rgba(9,16,24,0.55)', borderColor: 'rgba(127,212,200,0.22)', borderWidth: 1, radius: 12, fontSize: 22, opacity: 100 }, defaultProps: { showGlobal: true, showLocal: true }, defaultSize: { w: 360, h: 240 } },
  { type: 'variable-value', label: '变量值', category: '系统', defaultName: '变量值', defaultStyle: { color: '#e8edf2', fontSize: 32, fontWeight: 600, textAlign: 'center', opacity: 100 }, defaultProps: { variableId: '' }, defaultSize: { w: 200, h: 60 } },
  { type: 'shop-list', label: '商店列表', category: '商店', defaultName: '商店列表', defaultStyle: { color: '#e8edf2', fill: 'rgba(9,16,24,0.5)', borderColor: 'rgba(127,212,200,0.18)', borderWidth: 1, radius: 14, fontSize: 24, opacity: 100 }, defaultProps: { source: 'shop' }, defaultSize: { w: 520, h: 720 } },
  { type: 'date-display', label: '日期显示', category: '系统', defaultName: '日期显示', defaultStyle: { color: '#e8edf2', fontSize: 28, fontWeight: 600, textAlign: 'left', opacity: 100 }, defaultProps: { prefix: '公历' }, defaultSize: { w: 360, h: 48 } },
  { type: 'newspaper-button', label: '报纸按钮', category: '系统', defaultName: '报纸按钮', defaultStyle: { color: '#e8edf2', fill: 'rgba(120,150,180,0.08)', borderColor: 'rgba(150,180,210,0.16)', borderWidth: 1, radius: 12, fontSize: 20, opacity: 100 }, defaultProps: { text: '📰 日报' }, defaultSize: { w: 160, h: 52 } },
  { type: 'newspaper-panel', label: '日报面板', category: '系统', defaultName: '日报面板', defaultStyle: { color: '#3a2f1f', fill: 'rgba(245,239,224,0.97)', borderColor: 'rgba(227,166,75,0.28)', borderWidth: 1, radius: 12, fontSize: 24, opacity: 100 }, defaultProps: { newspaperName: '每日日报', largeSize: 34, smallSize: 24 }, defaultSize: { w: 800, h: 900 } },
  { type: 'world-map', label: '大地图', category: '地图', defaultName: '大地图', defaultStyle: { opacity: 100 }, defaultProps: {}, defaultSize: { w: 1920, h: 1080 } }
]

export function elementDef(type: ElementType): ElementTypeDef {
  return ELEMENT_CATALOG.find((d) => d.type === type) ?? ELEMENT_CATALOG[0]
}

// ---------- 脚本块 ----------
export type BlockType =
  | 'dialogue'
  | 'narration'
  | 'scene'
  | 'destroyScene'
  | 'wait'
  | 'curtain'
  | 'camera'
  | 'resetCamera'
  | 'particle'
  | 'floatingText'
  | 'sound'
  | 'stopSound'
  | 'showCharacter'
  | 'showScreen'
  | 'removeCharacter'
  | 'animateSprite'
  | 'branch'
  | 'callFragment'
  | 'returnToEntry'
  | 'setver'
  | 'comment'
  | 'video'
  | 'stopVideo'
  | 'switchDialogueStyle'
  | 'addToGallery'
  | 'addMusicToGallery'
  | 'addFragmentToGallery'
  | 'removeFromGallery'
  | 'clearGallery'
  | 'unlockAchievement'
  | 'endDay'
  | 'diceCheck'
  | 'mergedChoice'

export interface TextSegment {
  type: 'text' | 'link'
  text: string
  styles: Record<string, unknown>
  /** 链接型文本（辞典专有名词）指向的词条 id */
  termId?: string
}

export interface Block {
  id: string
  type: BlockType
  props: Record<string, unknown>
  content?: TextSegment[]
}

export interface Fragment {
  id: string
  name: string
  blocks: Block[]
}

export interface Chapter {
  id: string
  name: string
  fragments: Fragment[]
  /** 该章节对应的磁盘 .rpy 文件绝对路径（从磁盘加载时填充，用于写回） */
  filePath?: string
}

// ---------- 块参数 schema（对齐 Studio 的 BlockSchema） ----------
export interface BlockFieldSuggestions {
  key: string
  includeCharacterNames?: boolean
}

export type BlockSchemaField =
  | { type: 'string'; label?: string; default?: string; multiline?: boolean; required?: boolean; suggestions?: BlockFieldSuggestions }
  | { type: 'number'; label?: string; default?: number; min?: number; max?: number; step?: number; unit?: string }
  | { type: 'boolean'; label?: string; default?: boolean }
  | { type: 'enum'; label?: string; default?: string; options: { label: string; value: string }[] }
  | { type: 'asset'; label?: string; assetType?: 'image' | 'audio' | 'video' | 'any'; required?: boolean }
  | { type: 'character'; label?: string; required?: boolean }
  | { type: 'characterPortrait'; label?: string; characterField?: string; required?: boolean }
  | { type: 'characterSkin'; label?: string; characterField?: string; expressionField?: string }
  | { type: 'scene'; label?: string; required?: boolean }
  | { type: 'fragment'; label?: string; chapterField?: string; required?: boolean }
  | { type: 'position'; label?: string; default?: string }
  | { type: 'achievement'; label?: string; required?: boolean }
  | { type: 'color'; label?: string; default?: string }
  | { type: 'variable'; label?: string; required?: boolean }

export type BlockSchema = Record<string, BlockSchemaField>

export interface BlockTypeDef {
  type: BlockType
  label: string
  category: string
  defaultProps: Record<string, unknown>
  /** 参数检查器：按字段类型渲染对应的选择控件 */
  schema?: BlockSchema
}

const POSITION_OPTIONS = [
  { label: '左侧', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右侧', value: 'right' }
]

const TRANSITION_OPTIONS = [
  { label: '直接切换', value: 'cut' },
  { label: '溶解', value: 'dissolve' },
  { label: '淡入淡出', value: 'fade' },
  { label: '像素化', value: 'pixellate' },
  { label: '右侧移入', value: 'moveinright' },
  { label: '左侧移入', value: 'moveinleft' }
]

export const BLOCK_CATALOG: BlockTypeDef[] = [
  {
    type: 'dialogue', label: '对话', category: '对话',
    defaultProps: { characterId: '', characterName: '', expression: '', skin: '', position: '', showCharacter: true, keepCharacter: true, recordHistory: true },
    schema: {
      characterId: { type: 'character', label: '说话角色（留空为旁白）' },
      expression: { type: 'characterPortrait', label: '立绘表情', characterField: 'characterId' },
      skin: { type: 'characterSkin', label: '皮肤（选填）', characterField: 'characterId', expressionField: 'expression' },
      position: { type: 'enum', label: '立绘位置', options: POSITION_OPTIONS }
    }
  },
  { type: 'narration', label: '旁白', category: '对话', defaultProps: { recordHistory: true }, schema: { recordHistory: { type: 'boolean', label: '写入历史记录', default: true } } },
  {
    type: 'scene', label: '设置场景', category: '画面',
    defaultProps: { sceneImage: '', depth: 1, transitionMode: 'cut', transitionDuration: '500' },
    schema: {
      transitionMode: { type: 'enum', label: '转场方式', options: TRANSITION_OPTIONS },
      transitionDuration: { type: 'number', label: '转场时长', unit: 'ms', default: 500, min: 0 }
    }
  },
  {
    type: 'destroyScene', label: '清除场景', category: '画面',
    defaultProps: { transitionMode: 'fade', transitionDuration: '500' },
    schema: {
      transitionMode: { type: 'enum', label: '转场方式', options: TRANSITION_OPTIONS },
      transitionDuration: { type: 'number', label: '转场时长', unit: 'ms', default: 500, min: 0 }
    }
  },
  {
    type: 'showCharacter', label: '显示立绘', category: '立绘',
    defaultProps: { characterId: '', expression: '', skin: '', position: '' },
    schema: {
      characterId: { type: 'character', label: '角色', required: true },
      expression: { type: 'characterPortrait', label: '表情', characterField: 'characterId' },
      skin: { type: 'characterSkin', label: '皮肤（选填）', characterField: 'characterId', expressionField: 'expression' },
      position: { type: 'enum', label: '位置', options: POSITION_OPTIONS }
    }
  },
  { type: 'removeCharacter', label: '移除立绘', category: '立绘', defaultProps: { characterId: '' }, schema: { characterId: { type: 'character', label: '角色', required: true } } },
  { type: 'showScreen', label: '显示界面', category: '界面', defaultProps: { screenName: '' }, schema: { screenName: { type: 'string', label: '界面名（如 hud / history / save）' } } },
  { type: 'animateSprite', label: '立绘动画', category: '立绘', defaultProps: { characterId: '', animation: '' }, schema: { characterId: { type: 'character', label: '角色' }, animation: { type: 'string', label: '动画名' } } },
  {
    type: 'camera', label: '镜头移动', category: '画面', defaultProps: { target: '(0,0)', duration: '1000', zoom: '' },
    schema: { target: { type: 'position', label: '目标位置' }, duration: { type: 'number', label: '时长', unit: 'ms', default: 1000 }, zoom: { type: 'number', label: '缩放' } }
  },
  { type: 'resetCamera', label: '重置镜头', category: '画面', defaultProps: {} },
  {
    type: 'curtain', label: '转场幕布', category: '画面', defaultProps: { op: 'open', effect: 'fade', duration: '500', color: '#000000', mode: 'full-screen' },
    schema: {
      op: { type: 'enum', label: '操作', options: [{ label: '打开幕布', value: 'open' }, { label: '关闭幕布', value: 'close' }] },
      effect: { type: 'enum', label: '效果', options: TRANSITION_OPTIONS },
      duration: { type: 'number', label: '时长', unit: 'ms', default: 500 },
      color: { type: 'color', label: '幕布颜色', default: '#000000' }
    }
  },
  { type: 'particle', label: '粒子特效', category: '画面', defaultProps: { effectId: '' }, schema: { effectId: { type: 'string', label: '特效 id' } } },
  {
    type: 'floatingText', label: '漂浮文字', category: '画面',
    defaultProps: { position: '(50%,50%)', anchor: 'center', fontSize: '42', color: '#ffffff', duration: '2000' },
    schema: { position: { type: 'position', label: '位置' }, fontSize: { type: 'number', label: '字号', default: 42 }, color: { type: 'color', label: '颜色', default: '#ffffff' }, duration: { type: 'number', label: '持续时间', unit: 'ms', default: 2000 } }
  },
  { type: 'wait', label: '等待', category: '流程', defaultProps: { duration: '1000' }, schema: { duration: { type: 'number', label: '等待时长', unit: 'ms', default: 1000, min: 0 } } },
  { type: 'branch', label: '分支选项', category: '流程', defaultProps: { choices: [] } },
  { type: 'callFragment', label: '跳转片段', category: '流程', defaultProps: { target: '' }, schema: { target: { type: 'fragment', label: '目标片段' } } },
  { type: 'returnToEntry', label: '返回入口', category: '流程', defaultProps: {} },
  {
    type: 'setver', label: '变量操作', category: '变量',
    defaultProps: { variableId: '', operation: 'set', value: '0' },
    schema: {
      variableId: { type: 'variable', label: '变量', required: true },
      operation: { type: 'enum', label: '操作', options: [
        { label: '赋值（=）', value: 'set' },
        { label: '加法（+=）', value: 'add' },
        { label: '减法（-=）', value: 'subtract' },
        { label: '乘法（*=）', value: 'multiply' },
        { label: '除法（/=）', value: 'divide' }
      ] },
      value: { type: 'string', label: '值 / 表达式' }
    }
  },
  { type: 'comment', label: '注释', category: '其它', defaultProps: { text: '' }, schema: { text: { type: 'string', label: '注释内容', multiline: true } } },
  {
    type: 'sound', label: '播放音频', category: '音频',
    defaultProps: { soundType: 'BGM', uri: '', volume: '100', loop: 'true', fadeDuration: '' },
    schema: {
      soundType: { type: 'enum', label: '类型', options: [{ label: '背景音乐', value: 'BGM' }, { label: '音效', value: 'SE' }, { label: '语音', value: 'voice' }] },
      uri: { type: 'asset', label: '音频资源', assetType: 'audio', required: true },
      volume: { type: 'number', label: '音量', unit: '%', default: 100, max: 100 },
      loop: { type: 'boolean', label: '循环', default: true },
      fadeDuration: { type: 'number', label: '淡入时长', unit: 'ms' }
    }
  },
  {
    type: 'stopSound', label: '停止音频', category: '音频', defaultProps: { soundType: 'BGM', fadeDuration: '' },
    schema: {
      soundType: { type: 'enum', label: '类型', options: [{ label: '背景音乐', value: 'BGM' }, { label: '音效', value: 'SE' }, { label: '语音', value: 'voice' }] },
      fadeDuration: { type: 'number', label: '淡出时长', unit: 'ms' }
    }
  },
  { type: 'video', label: '播放视频', category: '其它', defaultProps: { uri: '', loop: 'false' }, schema: { uri: { type: 'asset', label: '视频资源', assetType: 'video', required: true }, loop: { type: 'boolean', label: '循环', default: false } } },
  { type: 'stopVideo', label: '停止视频', category: '其它', defaultProps: {} },
  { type: 'switchDialogueStyle', label: '切换对话样式', category: '对话', defaultProps: { styleId: '' }, schema: { styleId: { type: 'string', label: '样式 id' } } },
  {
    type: 'addToGallery', label: '加入鉴赏', category: '鉴赏',
    defaultProps: { sceneId: '', title: '' },
    schema: { sceneId: { type: 'scene', label: '鉴赏场景', required: true }, title: { type: 'string', label: '标题（选填，默认用场景名）' } }
  },
  {
    type: 'addMusicToGallery', label: '加入音乐鉴赏', category: '鉴赏',
    defaultProps: { audio: '', title: '', artist: '', description: '' },
    schema: {
      audio: { type: 'asset', label: '音乐资源', assetType: 'audio', required: true },
      title: { type: 'string', label: '曲名（选填）' },
      artist: { type: 'string', label: '作者（选填）' },
      description: { type: 'string', label: '曲目说明（选填）', multiline: true }
    }
  },
  {
    type: 'addFragmentToGallery', label: '加入片段鉴赏', category: '鉴赏',
    defaultProps: { fragmentId: '', chapterId: '', title: '', description: '', cover: '' },
    schema: {
      fragmentId: { type: 'fragment', label: '剧情片段', chapterField: 'chapterId', required: true },
      chapterId: { type: 'string', label: '章节 ID（选填）' },
      title: { type: 'string', label: '标题（选填，默认用片段名）' },
      description: { type: 'string', label: '片段说明（选填）', multiline: true },
      cover: { type: 'asset', label: '封面图（选填）', assetType: 'image' }
    }
  },
  { type: 'removeFromGallery', label: '移除鉴赏', category: '鉴赏', defaultProps: { sceneId: '' }, schema: { sceneId: { type: 'scene', label: '鉴赏场景', required: true } } },
  { type: 'clearGallery', label: '清空鉴赏', category: '鉴赏', defaultProps: {} },
  {
    type: 'unlockAchievement', label: '解锁成就', category: '成就',
    defaultProps: { achievementId: '' },
    schema: { achievementId: { type: 'achievement', label: '成就', required: true } }
  },
  {
    type: 'endDay', label: '结束今天', category: '流程',
    defaultProps: { sleepLabel: '' },
    schema: {
      sleepLabel: { type: 'string', label: '睡前剧情 label 名（日期+1 后跳转到此）' }
    }
  },
  {
    type: 'diceCheck', label: '骰子检定', category: '检定',
    defaultProps: { threshold: 50, bonus: 0, modifiers: [], successLabel: '', failureLabel: '' },
    schema: {
      threshold: { type: 'number', label: '难度阈值（DC）', default: 50, min: 1, max: 1000 },
      bonus: { type: 'number', label: '装备加成（越高越容易）', default: 0 },
      successLabel: { type: 'string', label: '成功跳转的 label' },
      failureLabel: { type: 'string', label: '失败跳转的 label' }
    }
  },
  {
    type: 'mergedChoice', label: '合并选择支', category: '流程',
    defaultProps: { choices: [] }
  }
]

export function blockDef(type: BlockType): BlockTypeDef {
  return BLOCK_CATALOG.find((d) => d.type === type) ?? BLOCK_CATALOG[0]
}

// ---------- 角色 ----------
export interface PortraitSkin {
  id: string
  name: string
  /** 皮肤图片（依附于所属立绘） */
  assetPath: string
}

export interface Expression {
  id: string
  name: string
  assetPath: string
  /** 皮肤：依附于该立绘的服装/外观变体 */
  skins: PortraitSkin[]
  avatarCrop?: { x: number; y: number; w: number; h: number }
}

export interface Character {
  id: string
  name: string
  /** 头像图片（独立于立绘） */
  avatar: string
  expressions: Expression[]
  themeColor: { bg: string; fg: string; ring: string }
  defaultPosition: string
}

// ---------- 场景 ----------
export interface SceneLayer {
  id: string
  name: string
  assetPath: string
  distance: number
}

export interface Scene {
  id: string
  name: string
  layers: SceneLayer[]
}

// ---------- 资产 ----------
export type AssetCategory =
  | 'background'
  | 'character'
  | 'cg'
  | 'particle'
  | 'bgm'
  | 'se'
  | 'voice'
  | 'video'
  | 'font'
  | 'other'

export interface AssetItem {
  id: string
  name: string
  path: string
  /** 相对项目根目录的路径（复制进项目文件夹后） */
  relativePath?: string
  category: AssetCategory
  dataUrl?: string
}

// ---------- 成就 ----------
export interface Achievement {
  id: string
  name: string
  description: string
  /** 图标资源 */
  icon: string
  /** 是否隐藏（未解锁时隐藏条目） */
  hidden: boolean
  /** 触发变量名（玩家不可见）：脚本中 $ 该变量 = True 时自动解锁成就 */
  variable: string
}

// ---------- 辞典（专有名词解释） ----------
export interface DictionaryEntry {
  id: string
  /** 专有名词 */
  term: string
  /** 别名/同义词（逗号分隔） */
  aliases: string
  /** 配图资源 */
  image: string
  /** 文字解释 */
  text: string
}

// ---------- 变量 ----------
export type VariableScope = 'global' | 'local'
export type VariableType = 'number' | 'string' | 'boolean'

export interface GameVariable {
  id: string
  /** 显示名（中文名，如「金钱」「时间」） */
  name: string
  /** Ren'Py 变量名（Python 标识符，如 money） */
  varName: string
  /** 默认值/赋值 */
  value: string
  /** 变量类型：数字 / 字符串 / 布尔 */
  type: VariableType
  /** 作用域：全局 / 局部 */
  scope: VariableScope
}

// ---------- 日程系统（日期 / 日报 / 天气与地图） ----------
export interface DateSystem {
  /** 开局日期：公历 */
  startYear: number
  startMonth: number
  startDay: number
}

export interface NewsEntry {
  id: string
  /** 新闻标题 */
  title: string
  /** 新闻正文 */
  body: string
  /** 大新闻 / 小新闻 */
  size: 'large' | 'small'
  /** 触发变量（变量为真时出现）；留空 = 随机出现 */
  triggerVariableId: string
  /** 随机出现权重（0-100，越大越容易） */
  weight: number
}

export interface WeatherMap {
  id: string
  /** 天气名：晴天 / 下雨 / 下雪 */
  name: string
  /** 视觉特效类型 */
  effect: 'sunny' | 'rain' | 'snow'
  /** 触发变量（变量为真时强制该天气）；留空 = 随机 */
  triggerVariableId: string
  /** 随机权重 */
  weight: number
  /** 该天气对应的游戏主界面地图背景图（留空 = 不换地图） */
  mapImage: string
}

// ---------- 大地图系统 ----------
export interface MapLocation {
  id: string
  /** 地点显示名 */
  name: string
  /** 地点图标（透明底 PNG），dataUrl / 相对路径 */
  image: string
  /** 悬停气泡文字 */
  tooltip: string
  /** 点击跳转的 label 名（留空 = 只移动不跳转） */
  targetLabel: string
  /** 地点在地图上的坐标（地图像素坐标） */
  x: number
  y: number
  /** 图标宽度（用于运行时缩放，默认 0 = 自适应） */
  iconWidth: number
}

export interface WorldMap {
  /** 地图背景图 */
  backgroundImage: string
  /** 地图尺寸（像素，超过游戏窗口时才能滚动） */
  width: number
  height: number
  /** 地点列表 */
  locations: MapLocation[]
  /** 玩家当前所在地点 id（空 = 未设置） */
  playerLocationId: string
  /** 玩家标识图片（可选，留空则用默认圆点标记） */
  playerMarkerImage: string
  /** 边缘自动滚动触发距离（像素） */
  edgeScrollMargin: number
  /** 缩放范围 */
  minZoom: number
  maxZoom: number
}

// ---------- 全局字体 ----------
export interface ThemeFonts {
  /** 按钮文字 + 角色名 + 标题等界面文字 */
  uiFontFamily: string
  /** 对话框中的对白文本 */
  dialogueFontFamily: string
}

// ---------- 项目 ----------
export interface Project {
  name: string
  version: string
  resolution: { width: number; height: number }
  backgroundColor: string
  chapterOrder: string[]
  chapters: Chapter[]
  characters: Character[]
  scenes: Scene[]
  uiScreens: Record<string, UiScreen>
  achievements: Achievement[]
  dictionary: DictionaryEntry[]
  variables: GameVariable[]
  dateSystem: DateSystem
  news: NewsEntry[]
  weatherMaps: WeatherMap[]
  worldMap: WorldMap
  themeFonts: ThemeFonts
}

// ============================================================
// 工具函数
// ============================================================

let counter = 0
export function uid(prefix = ''): string {
  counter += 1
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function createElement(type: ElementType): UiElement {
  const def = elementDef(type)
  const id = uid('el-')
  return {
    id,
    refId: id,
    type,
    name: def.defaultName,
    rect: { x: 80, y: 80, w: def.defaultSize.w, h: def.defaultSize.h },
    anchor: 'tl',
    style: { ...def.defaultStyle },
    props: { ...def.defaultProps }
  }
}

export function createBlock(type: BlockType): Block {
  const def = blockDef(type)
  const b: Block = { id: uid('blk-'), type, props: { ...def.defaultProps, disabled: false } }
  if (type === 'dialogue' || type === 'narration' || type === 'floatingText') {
    b.content = [{ type: 'text', text: '', styles: {} }]
  }
  return b
}

/** 判断元素是否为整屏遮罩/背景（应垫在所有控件之下） */
export function isBackdrop(el: UiElement): boolean {
  if (el.type === 'background-mask' || el.type === 'dialogue-backdrop') return true
  return el.type === 'rect' && (el.name === '遮罩' || el.name === '背景遮罩')
}

/** 渲染顺序：把遮罩/背景垫到最底层，其余保持原顺序 */
export function orderElementsForRender(elements: UiElement[]): UiElement[] {
  return [...elements].sort((a, b) => Number(isBackdrop(b)) - Number(isBackdrop(a)))
}
