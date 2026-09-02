// ============================================================
// 对话 UI 编辑器的配置模型
// 这些参数驱动预览画布，并生成对应的 Ren'Py screens.rpy 代码
// ============================================================

export interface SpriteConfig {
  id: string
  image: string | null // data URL 或项目图片 tag
  tag: string // 显示用的图片名/tag
  pos: 'left' | 'center' | 'right'
  zoom: number
}

export interface CharacterConfig {
  key: string // 变量名，如 "e"
  name: string // 显示名，如 "Eileen"
  color: string
  avatar: string | null // 头像图片（data URL）
  avatarTag: string
}

export interface UiConfig {
  screen: {
    width: number
    height: number
  }

  textBox: {
    widthRatio: number // 相对屏幕宽，如 1/3 = 0.333
    align: 'left' | 'right'
    fullHeight: boolean // 是否垂直占满
    padding: number
    bgColor: string
    bgAlpha: number // 0-1
    textColor: string
    fontSize: number
    lineSpacing: number
    font: string
  }

  avatar: {
    enabled: boolean
    size: number // 边长(px)
    outside: boolean // 是否在文本框左侧外侧
    gap: number // 与文本框间距
  }

  name: {
    enabled: boolean
    fontSize: number
    color: string
  }

  scrollback: {
    enabled: boolean
    maxLines: number
  }

  scene: {
    background: string | null
    backgroundTag: string
    sprites: SpriteConfig[]
  }

  characters: CharacterConfig[]
}

export const defaultConfig: UiConfig = {
  screen: { width: 1920, height: 1080 },
  textBox: {
    widthRatio: 0.333,
    align: 'right',
    fullHeight: true,
    padding: 24,
    bgColor: '#1b1b22',
    bgAlpha: 0.85,
    textColor: '#f5f5f5',
    fontSize: 28,
    lineSpacing: 1.35,
    font: ''
  },
  avatar: {
    enabled: true,
    size: 96,
    outside: true,
    gap: 16
  },
  name: {
    enabled: true,
    fontSize: 24,
    color: '#ffd27f'
  },
  scrollback: {
    enabled: true,
    maxLines: 100
  },
  scene: {
    background: null,
    backgroundTag: '',
    sprites: []
  },
  characters: [
    { key: 'e', name: 'Eileen', color: '#ffd27f', avatar: null, avatarTag: '' },
    { key: 'n', name: '旁白', color: '#9ad0ff', avatar: null, avatarTag: '' }
  ]
}

/** 一条对话（用于预览滚动历史） */
export interface DialogueLine {
  id: number
  who: string // 显示名，空为旁白
  whoColor: string
  avatar: string | null // data URL
  what: string
}
