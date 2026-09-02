import type { Project, UiScreen, Character, Scene, UiElement, ElementType, UiStyle, Rect, Achievement, DictionaryEntry, GameVariable, DateSystem, NewsEntry, WeatherMap, WorldMap } from './model'
import { uid } from './model'

/** 快速创建 UI 元素 */
function mk(
  type: ElementType,
  name: string,
  rect: Rect,
  style: UiStyle = {},
  props: Record<string, unknown> = {}
): UiElement {
  const id = uid('el-')
  return { id, refId: id, type, name, rect, anchor: 'tl', style: { opacity: 100, ...style }, props }
}

// ============================================================
// 默认项目 —— 预置一个「竖版对话框」UI，满足：
//   文本框靠右占 1/3、头像+角色名在左侧、对话可回滚
// ============================================================

/** 竖版对话界面：文本框靠右 1/3，头像+角色名在其左侧，历史可滚动 */
function verticalDialogueScreen(): UiScreen {
  return {
    version: 2,
    name: '竖版对话',
    canvas: { width: 1920, height: 1080 },
    elements: [
      {
        id: uid('el-'),
        refId: 'dialogue-backdrop',
        type: 'dialogue-backdrop',
        name: '舞台遮罩',
        rect: { x: 0, y: 0, w: 1920, h: 1080 },
        anchor: 'c',
        style: { fill: '#000000', opacity: 0 },
        props: {}
      },
      {
        id: uid('el-'),
        refId: 'dialogue-frame',
        type: 'dialogue-frame',
        name: '竖版框体（右侧 1/3）',
        rect: { x: 1280, y: 0, w: 640, h: 1080 },
        anchor: 'tl',
        style: {
          fill: 'rgba(20,20,28,0.92)',
          borderColor: 'rgba(255,255,255,0.10)',
          borderWidth: 0,
          radius: 0,
          opacity: 100
        },
        props: {
          linearGradient: {
            enabled: true,
            angle: 90,
            startColor: 'rgba(20,20,28,0.95)',
            endColor: 'rgba(20,20,28,0.85)'
          }
        }
      },
      {
        id: uid('el-'),
        refId: 'dialogue-history',
        type: 'history-list',
        name: '滚动历史',
        rect: { x: 1160, y: 72, w: 720, h: 960 },
        anchor: 'tl',
        style: {
          color: '#f3ede2',
          fontSize: 28,
          fill: 'transparent',
          borderWidth: 0,
          radius: 0,
          opacity: 100
        },
        props: {
          maxEntries: 200,
          gap: 14,
          showSpeaker: true,
          showAvatar: true,
          showTimeline: false,
          emptyText: '还没有可以回看的对话',
          showCurrent: true,
          avatarSize: 96,
          nameColor: '#ffd88a',
          nameSize: 30,
          previewText: '有些故事，会从一个看似普通的夜晚开始。\n而我们，刚好站在它的入口。',
          previewWho: '角色名'
        }
      },
      {
        id: uid('el-'),
        refId: 'dialogue-wait-cursor',
        type: 'dialogue-wait-cursor',
        name: '等待提示',
        rect: { x: 1852, y: 1016, w: 28, h: 28 },
        anchor: 'tl',
        style: { color: '#ffffff', opacity: 100 },
        props: { shape: 'diamond', animation: 'rotate', durationMs: 1000 }
      }
    ],
    dialogueBehavior: { text_speed: 30 }
  }
}

/** 标题画面 */
function titleScreen(): UiScreen {
  const buttons = [
    { name: '开始游戏', y: 400, text: '开始游戏' },
    { name: '读取存档', y: 496, text: '读取存档' },
    { name: '设置', y: 592, text: '设置' },
    { name: '关于', y: 688, text: '关于' },
    { name: '退出', y: 784, text: '退出' }
  ]
  return {
    version: 1,
    name: '标题画面',
    canvas: { width: 1920, height: 1080 },
    elements: [
      mk('rect', '背景遮罩', { x: 0, y: 0, w: 1920, h: 1080 }, { fill: 'rgba(8,13,20,0.92)', backdropBlur: 24 }),
      mk('line', '顶部细线', { x: 48, y: 40, w: 1824, h: 2 }, { fill: '#7fd4c8', opacity: 40 }),
      mk('text', '游戏标题', { x: 96, y: 180, w: 800, h: 120 }, { color: '#e8edf2', fontSize: 88, fontWeight: 700, letterSpacing: 6 }, { text: '我的视觉小说' }),
      mk('text', '副标题', { x: 100, y: 316, w: 600, h: 36 }, { color: 'rgba(232,237,242,0.6)', fontSize: 20, letterSpacing: 4 }, { text: '— 一个全新的故事 —' }),
      ...buttons.map((b) =>
        mk('button', `按钮_${b.name}`, { x: 144, y: b.y, w: 520, h: 72 }, { color: '#dce8f2', fill: 'rgba(120,150,180,0.06)', borderColor: 'rgba(150,180,210,0.14)', borderWidth: 1, radius: 12, fontSize: 26 }, { text: b.text })
      ),
      mk('text', '版本号', { x: 1536, y: 56, w: 320, h: 24 }, { color: 'rgba(232,237,242,0.46)', fontSize: 14, letterSpacing: 2 }, { text: 'v1.0.0' }),
      mk('text', '版权', { x: 1536, y: 1000, w: 320, h: 24 }, { color: 'rgba(232,237,242,0.46)', fontSize: 14, textAlign: 'right' }, { text: '© 2026' })
    ]
  }
}

/** 历史记录界面 */
function historyScreen(): UiScreen {
  return {
    version: 1,
    name: '历史记录',
    canvas: { width: 1920, height: 1080 },
    elements: [
      mk('rect', '遮罩', { x: 0, y: 0, w: 1920, h: 1080 }, { fill: 'rgba(8,13,20,0.88)', backdropBlur: 28 }),
      mk('text', '标题', { x: 120, y: 122, w: 600, h: 80 }, { color: '#e8edf2', fontSize: 56, letterSpacing: 2 }, { text: '历史记录' }),
      mk('rect', '短横线', { x: 120, y: 212, w: 72, h: 4 }, { fill: '#7fd4c8', radius: 999 }),
      mk('button', '关闭', { x: 1748, y: 118, w: 52, h: 52 }, { color: '#dce8f2', fill: 'rgba(120,150,180,0.06)', borderColor: 'rgba(150,180,210,0.14)', borderWidth: 1, radius: 12, fontSize: 22 }, { text: '✕' }),
      mk('history-list', '历史记录_对话', { x: 300, y: 264, w: 1320, h: 718 }, { color: '#e8edf2', fontSize: 22, fill: 'rgba(9,16,24,0.58)', borderColor: 'rgba(127,212,200,0.22)', borderWidth: 1, radius: 18 }, { maxEntries: 200, gap: 12, showSpeaker: true, showAvatar: true, showTimeline: false, emptyText: '还没有可以回看的对话', accentColor: '#7fd4c8' })
    ]
  }
}

/** 存档/读档界面 */
function saveScreen(): UiScreen {
  return {
    version: 1,
    name: '存档读档',
    canvas: { width: 1920, height: 1080 },
    elements: [
      mk('rect', '遮罩', { x: 0, y: 0, w: 1920, h: 1080 }, { fill: 'rgba(8,13,20,0.9)', backdropBlur: 24 }),
      mk('text', '标题', { x: 120, y: 122, w: 800, h: 80 }, { color: '#e8edf2', fontSize: 56, letterSpacing: 2 }, { text: '存档读档' }),
      mk('rect', '短横线', { x: 120, y: 212, w: 72, h: 4 }, { fill: '#7fd4c8', radius: 999 }),
      mk('button', '关闭', { x: 1748, y: 118, w: 52, h: 52 }, { color: '#dce8f2', fill: 'rgba(120,150,180,0.06)', borderColor: 'rgba(150,180,210,0.14)', borderWidth: 1, radius: 12, fontSize: 22 }, { text: '✕' }),
      mk('save-grid', '存档网格', { x: 120, y: 264, w: 1680, h: 720 }, { fill: 'rgba(9,16,24,0.5)', borderColor: 'rgba(127,212,200,0.18)', borderWidth: 1, radius: 18 })
    ]
  }
}

/** 鉴赏界面（CG / 音乐 / 片段） */
function galleryScreen(): UiScreen {
  return {
    version: 1,
    name: '鉴赏界面',
    canvas: { width: 1920, height: 1080 },
    elements: [
      mk('rect', '遮罩', { x: 0, y: 0, w: 1920, h: 1080 }, { fill: 'rgba(8,13,20,0.92)', backdropBlur: 28 }),
      mk('text', '标题', { x: 120, y: 118, w: 600, h: 80 }, { color: '#e8edf2', fontSize: 56, letterSpacing: 2 }, { text: '鉴赏' }),
      mk('rect', '短横线', { x: 120, y: 208, w: 72, h: 4 }, { fill: '#e3a64b', radius: 999 }),
      mk('button', '关闭', { x: 1748, y: 118, w: 52, h: 52 }, { color: '#dce8f2', fill: 'rgba(120,150,180,0.06)', borderColor: 'rgba(150,180,210,0.14)', borderWidth: 1, radius: 12, fontSize: 22 }, { text: '✕' }),
      mk('tabs', '鉴赏页签', { x: 300, y: 118, w: 600, h: 52 }, { color: '#e3a64b' }, { tabs: ['CG 画廊', '音乐', '片段'] }),
      mk('cg-gallery', 'CG鉴赏', { x: 100, y: 286, w: 1712, h: 680 }, { color: '#e8edf2', opacity: 100 }, { cols: 4, rows: 2, gap: 20, emptyText: '尚未回收任何影像档案', accentColor: '#e3a64b' }),
      mk('music-gallery', '音乐鉴赏', { x: 100, y: 286, w: 1712, h: 680 }, { color: '#e8edf2', opacity: 100 }, { emptyText: '尚未截获任何音频信号', accentColor: '#e3a64b', showArtist: true, showDescription: true }),
      mk('fragment-gallery', '片段鉴赏', { x: 100, y: 286, w: 1712, h: 680 }, { color: '#e8edf2', opacity: 100 }, { cols: 3, rows: 2, gap: 20, emptyText: '尚未解密任何剧情记录', accentColor: '#e3a64b', showDescription: true })
    ]
  }
}

/** 日报界面：标题 + 当日新闻（大小新闻），由「日程」页的新闻池按日期/变量/随机生成 */
function newspaperScreen(): UiScreen {
  return {
    version: 1,
    name: '日报',
    canvas: { width: 1920, height: 1080 },
    elements: [
      mk('rect', '遮罩', { x: 0, y: 0, w: 1920, h: 1080 }, { fill: 'rgba(8,13,20,0.82)', backdropBlur: 16 }),
      mk('button', '关闭', { x: 1748, y: 118, w: 52, h: 52 }, { color: '#dce8f2', fill: 'rgba(120,150,180,0.06)', borderColor: 'rgba(150,180,210,0.14)', borderWidth: 1, radius: 12, fontSize: 22 }, { text: '✕' }),
      mk('newspaper-panel', '日报面板', { x: 560, y: 60, w: 800, h: 900 }, { color: '#3a2f1f', fill: 'rgba(245,239,224,0.97)', borderColor: 'rgba(227,166,75,0.28)', borderWidth: 1, radius: 12, fontSize: 24 }, { newspaperName: '每日日报', largeSize: 34, smallSize: 24 })
    ]
  }
}

/** 成就界面 */
function achievementScreen(): UiScreen {
  return {
    version: 1,
    name: '成就界面',
    canvas: { width: 1920, height: 1080 },
    elements: [
      mk('rect', '遮罩', { x: 0, y: 0, w: 1920, h: 1080 }, { fill: 'rgba(8,13,20,0.92)', backdropBlur: 28 }),
      mk('text', '标题', { x: 120, y: 118, w: 600, h: 80 }, { color: '#e8edf2', fontSize: 56, letterSpacing: 2 }, { text: '成就' }),
      mk('rect', '短横线', { x: 120, y: 208, w: 72, h: 4 }, { fill: '#ffd88a', radius: 999 }),
      mk('button', '关闭', { x: 1748, y: 118, w: 52, h: 52 }, { color: '#dce8f2', fill: 'rgba(120,150,180,0.06)', borderColor: 'rgba(150,180,210,0.14)', borderWidth: 1, radius: 12, fontSize: 22 }, { text: '✕' }),
      mk('achievement-list', '成就列表', { x: 120, y: 264, w: 1680, h: 720 }, { color: '#e8edf2', fill: 'rgba(9,16,24,0.5)', borderColor: 'rgba(255,216,138,0.18)', borderWidth: 1, radius: 18 }, { cols: 4, gap: 20, emptyText: '尚未解锁任何成就', accentColor: '#ffd88a' })
    ]
  }
}

/** 辞典弹窗界面 */
function dictionaryPopupScreen(): UiScreen {
  return {
    version: 1,
    name: '辞典弹窗',
    canvas: { width: 1920, height: 1080 },
    elements: [
      mk('rect', '遮罩', { x: 0, y: 0, w: 1920, h: 1080 }, { fill: 'rgba(0,0,0,0.5)', backdropBlur: 6 }),
      mk('dictionary-popup', '辞典弹窗', { x: 600, y: 300, w: 720, h: 480 }, { color: '#e8edf2', fill: 'rgba(9,16,24,0.94)', radius: 16, borderColor: 'rgba(127,212,200,0.3)', borderWidth: 1 }, { accentColor: '#7fd4c8' })
    ]
  }
}

/** 变量 HUD：游戏内常驻界面，垫在对话框下面、立绘上面，显示日期、变量名与数值、报纸按钮 */
function variableHudScreen(): UiScreen {
  return {
    version: 1,
    name: '变量显示',
    canvas: { width: 1920, height: 1080 },
    zorder: 50,
    elements: [
      mk('date-display', '日期显示', { x: 40, y: 40, w: 380, h: 48 }, { color: '#ffd88a', fontSize: 28, fontWeight: 600, textAlign: 'left' }, { prefix: '公历' }),
      mk('variable-panel', '变量面板', { x: 40, y: 108, w: 360, h: 240 }, { color: '#e8edf2', fill: 'rgba(9,16,24,0.55)', borderColor: 'rgba(127,212,200,0.22)', borderWidth: 1, radius: 12, fontSize: 22, opacity: 100 }, { showGlobal: true, showLocal: true }),
      mk('newspaper-button', '报纸按钮', { x: 1760, y: 40, w: 120, h: 52 }, { color: '#e8edf2', fill: 'rgba(120,150,180,0.08)', borderColor: 'rgba(150,180,210,0.16)', borderWidth: 1, radius: 12, fontSize: 20 }, { text: '📰 日报' })
    ]
  }
}

/** 设置界面 */
function settingsScreen(): UiScreen {
  return {
    version: 1,
    name: '设置',
    canvas: { width: 1920, height: 1080 },
    elements: [
      mk('rect', '遮罩', { x: 0, y: 0, w: 1920, h: 1080 }, { fill: 'rgba(8,13,20,0.9)', backdropBlur: 24 }),
      mk('text', '标题', { x: 120, y: 122, w: 800, h: 80 }, { color: '#e8edf2', fontSize: 56, letterSpacing: 2 }, { text: '设置' }),
      mk('rect', '短横线', { x: 120, y: 212, w: 72, h: 4 }, { fill: '#7fd4c8', radius: 999 }),
      mk('button', '关闭', { x: 1748, y: 118, w: 52, h: 52 }, { color: '#dce8f2', fill: 'rgba(120,150,180,0.06)', borderColor: 'rgba(150,180,210,0.14)', borderWidth: 1, radius: 12, fontSize: 22 }, { text: '✕' }),
      mk('text', '音量', { x: 120, y: 300, w: 300, h: 40 }, { color: '#e8edf2', fontSize: 28 }, { text: '音乐音量' }),
      mk('slider', '音乐音量滑块', { x: 480, y: 308, w: 600, h: 24 }, { color: '#7fd4c8' }, { value: 70 }),
      mk('text', '语音音量', { x: 120, y: 380, w: 300, h: 40 }, { color: '#e8edf2', fontSize: 28 }, { text: '语音音量' }),
      mk('slider', '语音音量滑块', { x: 480, y: 388, w: 600, h: 24 }, { color: '#7fd4c8' }, { value: 70 }),
      mk('text', '全屏', { x: 120, y: 460, w: 300, h: 40 }, { color: '#e8edf2', fontSize: 28 }, { text: '全屏模式' }),
      mk('switch', '全屏开关', { x: 480, y: 468, w: 80, h: 40 }, { color: '#7fd4c8' }, { value: true }),
      mk('text', '文字速度', { x: 120, y: 540, w: 300, h: 40 }, { color: '#e8edf2', fontSize: 28 }, { text: '文字速度' }),
      mk('slider', '文字速度滑块', { x: 480, y: 548, w: 600, h: 24 }, { color: '#7fd4c8' }, { value: 30 })
    ]
  }
}

/** 大地图界面：最底层（zorder 0），铺满整个窗口，可缩放/拖曳，地点可点击跳转 */
function mapScreen(): UiScreen {
  return {
    version: 1,
    name: '大地图',
    canvas: { width: 1920, height: 1080 },
    zorder: 0,
    elements: [
      mk('world-map', '大地图', { x: 0, y: 0, w: 1920, h: 1080 }, { opacity: 100 }, {})
    ]
  }
}

/** 商店 / 背包界面：左侧背包（可卖出）、右侧商品（可买入）、金币显示 */
function shopScreen(): UiScreen {
  return {
    version: 1,
    name: '商店',
    canvas: { width: 1920, height: 1080 },
    elements: [
      mk('rect', '遮罩', { x: 0, y: 0, w: 1920, h: 1080 }, { fill: 'rgba(8,13,20,0.9)', backdropBlur: 24 }),
      mk('text', '标题', { x: 660, y: 104, w: 600, h: 72 }, { color: '#e8edf2', fontSize: 52, fontWeight: 700, letterSpacing: 2, textAlign: 'center' }, { text: '商店菜单' }),
      mk('button', '关闭', { x: 1748, y: 118, w: 52, h: 52 }, { color: '#dce8f2', fill: 'rgba(120,150,180,0.06)', borderColor: 'rgba(150,180,210,0.14)', borderWidth: 1, radius: 12, fontSize: 22 }, { text: '✕' }),
      mk('text', '金币标签', { x: 120, y: 112, w: 140, h: 60 }, { color: '#e3a64b', fontSize: 30, fontWeight: 600, textAlign: 'left' }, { text: '金币：' }),
      mk('variable-value', '金币数值', { x: 260, y: 112, w: 200, h: 60 }, { color: '#e3a64b', fontSize: 30, fontWeight: 600, textAlign: 'left' }, { variableId: 'var-gold' }),
      mk('text', '背包标题', { x: 120, y: 230, w: 300, h: 50 }, { color: '#7fd4c8', fontSize: 30, fontWeight: 600, textAlign: 'left' }, { text: '我的背包' }),
      mk('shop-list', '背包列表', { x: 120, y: 300, w: 520, h: 720 }, { color: '#e8edf2', fontSize: 24, fill: 'rgba(9,16,24,0.5)', borderColor: 'rgba(127,212,200,0.18)', borderWidth: 1, radius: 14 }, { source: 'inventory' }),
      mk('text', '商品标题', { x: 1280, y: 230, w: 300, h: 50 }, { color: '#e3a64b', fontSize: 30, fontWeight: 600, textAlign: 'left' }, { text: '商店商品' }),
      mk('shop-list', '商品列表', { x: 1280, y: 300, w: 520, h: 720 }, { color: '#e8edf2', fontSize: 24, fill: 'rgba(9,16,24,0.5)', borderColor: 'rgba(227,166,75,0.18)', borderWidth: 1, radius: 14 }, { source: 'shop' })
    ]
  }
}

function sampleCharacters(): Character[] {
  return [
    {
      id: uid('ch-'),
      name: '影缝',
      avatar: 'characters/影缝/头像.png',
      expressions: [
        {
          id: uid('ex-'),
          name: '平静',
          assetPath: 'characters/影缝/平静.png',
          skins: [
            { id: uid('sk-'), name: '礼服', assetPath: 'characters/影缝/平静_礼服.png' },
            { id: uid('sk-'), name: '便装', assetPath: 'characters/影缝/平静_便装.png' }
          ]
        },
        { id: uid('ex-'), name: '生气', assetPath: 'characters/影缝/生气.png', skins: [] },
        { id: uid('ex-'), name: '害羞', assetPath: 'characters/影缝/害羞.png', skins: [] }
      ],
      themeColor: { bg: '#dbeafe', fg: '#1e40af', ring: '#60a5fa' },
      defaultPosition: 'left'
    },
    {
      id: uid('ch-'),
      name: '真琴',
      avatar: 'characters/真琴/头像.png',
      expressions: [
        {
          id: uid('ex-'),
          name: '微笑',
          assetPath: 'characters/真琴/微笑.png',
          skins: [
            { id: uid('sk-'), name: '外套', assetPath: 'characters/真琴/微笑_外套.png' },
            { id: uid('sk-'), name: '裙装', assetPath: 'characters/真琴/微笑_裙装.png' }
          ]
        },
        { id: uid('ex-'), name: '惊讶', assetPath: 'characters/真琴/惊讶.png', skins: [] }
      ],
      themeColor: { bg: '#ffe4e6', fg: '#9f1239', ring: '#fb7185' },
      defaultPosition: 'right'
    }
  ]
}

function sampleAchievements(): Achievement[] {
  return [
    { id: uid('ac-'), name: '初次相遇', description: '完成序章剧情', icon: '', hidden: false, variable: 'ach_first_meeting' },
    { id: uid('ac-'), name: '全收藏', description: '回收全部 CG 鉴赏', icon: '', hidden: false, variable: 'ach_all_cg' }
  ]
}

function sampleDictionary(): DictionaryEntry[] {
  return [
    { id: uid('dic-'), term: '影缝', aliases: '', image: '', text: '本作女主角之一。性格冷静，善于观察。' },
    { id: uid('dic-'), term: '境界线', aliases: '世界线,边界', image: '', text: '分隔两个世界的界线，只有特定之人能够跨越。' }
  ]
}

function sampleScenes(): Scene[] {
  return [
    {
      id: uid('sc-'),
      name: '教室',
      layers: [{ id: uid('ly-'), name: '教室背景', assetPath: 'backgrounds/教室.png', distance: 1 }]
    }
  ]
}

function sampleVariables(): GameVariable[] {
  return [
    { id: 'var-gold', name: '金币', varName: 'player_gold', value: '100', type: 'number', scope: 'global' },
    { id: uid('var-'), name: '金钱', varName: 'money', value: '0', type: 'number', scope: 'global' },
    { id: uid('var-'), name: '时间', varName: 'time', value: '清晨', type: 'string', scope: 'global' },
    { id: uid('var-'), name: '是否告白', varName: 'confessed', value: 'false', type: 'boolean', scope: 'local' }
  ]
}

function sampleDateSystem(): DateSystem {
  return { startYear: 2026, startMonth: 9, startDay: 2 }
}

function sampleNews(): NewsEntry[] {
  return [
    { id: uid('news-'), title: '学院祭即将开幕', body: '一年一度的学院祭将于本周举行，欢迎各位同学踊跃参加。', size: 'large', triggerVariableId: '', weight: 40 },
    { id: uid('news-'), title: '图书馆新书上架', body: '图书馆本月新增一批推理小说，可在二楼借阅。', size: 'small', triggerVariableId: '', weight: 40 },
    { id: uid('news-'), title: '神秘来信', body: '你在鞋柜里发现了一封没有署名的信。', size: 'large', triggerVariableId: '', weight: 10 }
  ]
}

function sampleWeatherMaps(): WeatherMap[] {
  return [
    { id: uid('wm-'), name: '晴天', effect: 'sunny', triggerVariableId: '', weight: 60, mapImage: '' },
    { id: uid('wm-'), name: '下雨', effect: 'rain', triggerVariableId: '', weight: 20, mapImage: '' },
    { id: uid('wm-'), name: '下雪', effect: 'snow', triggerVariableId: '', weight: 20, mapImage: '' }
  ]
}

function sampleWorldMap(): WorldMap {
  const home = uid('loc-')
  const school = uid('loc-')
  const shop = uid('loc-')
  return {
    backgroundImage: '',
    width: 3200,
    height: 1800,
    locations: [
      { id: home, name: '家', image: '', tooltip: '回家', targetLabel: 'home', x: 400, y: 700, iconWidth: 0 },
      { id: school, name: '学院', image: '', tooltip: '前往学院', targetLabel: 'school', x: 1600, y: 500, iconWidth: 0 },
      { id: shop, name: '商店街', image: '', tooltip: '去商店街逛逛', targetLabel: 'shop', x: 2400, y: 1100, iconWidth: 0 }
    ],
    playerLocationId: home,
    playerMarkerImage: '',
    edgeScrollMargin: 60,
    minZoom: 0.25,
    maxZoom: 4
  }
}

export function createDefaultProject(): Project {
  return {
    name: '未命名项目',
    version: '1.0.0',
    resolution: { width: 1920, height: 1080 },
    backgroundColor: '#000000',
    chapterOrder: ['开始'],
    chapters: [
      {
        id: uid('cp-'),
        name: '开始',
        fragments: [{ id: uid('fg-'), name: 'main', blocks: [] }]
      }
    ],
    characters: sampleCharacters(),
    scenes: sampleScenes(),
    uiScreens: {
      'dialogue-box': verticalDialogueScreen(),
      'variable-hud': variableHudScreen(),
      'title-screen': titleScreen(),
      'history-screen': historyScreen(),
      'save-screen': saveScreen(),
      'settings-screen': settingsScreen(),
      'shop-screen': shopScreen(),
      'gallery-screen': galleryScreen(),
      'achievement-screen': achievementScreen(),
      'dictionary-popup': dictionaryPopupScreen(),
      'newspaper-screen': newspaperScreen(),
      'map-screen': mapScreen()
    },
    achievements: sampleAchievements(),
    dictionary: sampleDictionary(),
    variables: sampleVariables(),
    dateSystem: sampleDateSystem(),
    news: sampleNews(),
    weatherMaps: sampleWeatherMaps(),
    worldMap: sampleWorldMap(),
    themeFonts: {
      uiFontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
      dialogueFontFamily: "'PingFang SC','Microsoft YaHei',sans-serif"
    }
  }
}
