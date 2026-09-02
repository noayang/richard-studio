// ============================================================
// 导出 Ren'Py 代码：把 UiScreen + 脚本块 转成 .rpy
// ============================================================

import type { Project, UiScreen, UiElement, Block, Chapter, GameVariable, Scene } from '../model'

function q(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

/** 把变量名规范成合法的 Python 标识符（默认前面加下划线避免以数字开头） */
function sanitizeVar(v: string): string {
  const s = v.trim().replace(/[^A-Za-z0-9_]/g, '_')
  return /^[0-9]/.test(s) ? '_' + s : s
}

/** 把 UiScreen 转成 Ren'Py screen 代码 */
export function exportScreen(screen: UiScreen, screenName: string, variables: GameVariable[] = [], scenes: Scene[] = []): string {
  const lines: string[] = []
  const { width, height } = screen.canvas
  lines.push(`## ${screen.name} (由 Richard Studio 生成)`)
  lines.push(`screen ${screenName}:`)
  lines.push(`    zorder ${screen.zorder ?? 100}`)
  for (const el of screen.elements) {
    const code = exportElement(el, width, height, variables, scenes)
    if (code) lines.push(...code.map((l) => '    ' + l))
  }
  lines.push('')
  return lines.join('\n')
}

function rgbaToHex(c: string): string {
  if (c.startsWith('#')) return c
  return '#000000'
}

function exportElement(el: UiElement, cw: number, ch: number, variables: GameVariable[] = [], scenes: Scene[] = []): string[] | null {
  const s = el.style
  const x = el.rect.x
  const y = el.rect.y
  const w = el.rect.w
  const h = el.rect.h
  const posProps = `pos (${x}, ${y}) xysize (${w}, ${h})`

  switch (el.type) {
    case 'dialogue-frame':
      return [`frame:`, `    ${posProps}`, `    background Solid(${q(rgbaToHex(String(s.fill ?? '#14141c')))} ${((s.opacity ?? 100) / 100).toFixed(2)})`]
    case 'dialogue-text':
      return [`text what:`, `    ${posProps}`, `    color ${q(String(s.color ?? '#fff'))}`, `    size ${s.fontSize ?? 28}`, `    line_spacing ${s.lineHeight ?? 1.75}`]
    case 'dialogue-name':
      return [`if who is not None:`, `    text who:`, `        ${posProps}`, `        color ${q(String(s.color ?? '#ffd88a'))}`, `        size ${s.fontSize ?? 30}`]
    case 'image':
      return [`add ${q(String(el.props.src ?? 'avatar.png'))}:`, `    ${posProps}`]
    case 'dialogue-wait-cursor':
      return [`## 等待提示: ${posProps}`]
    case 'history-list': {
      const avatarSize = Number(el.props.avatarSize ?? 96)
      const nameSize = Number(el.props.nameSize ?? 30)
      const textSize = s.fontSize ?? 28
      const textColor = q(String(s.color ?? '#fff'))
      // 头像 + 角色名放在对话框外侧（左侧列），对白文本在右侧，随历史一起滚动；
      // 旁白（无角色说话）时不渲染头像/角色名，只显示文本；
      // 滚出 viewport 顶部时会被裁剪，从而实现「快超出游戏窗口时头像/角色名一齐消失」。
      const lines = [
        `viewport:`,
        `    ${posProps}`,
        `    mousewheel True`,
        `    yinitial 1.0`,
        `    vbox:`,
        `        spacing 20`,
        `        for h in _history_list:`,
        `            hbox:`,
        `                spacing 24`,
        `                if h.who:`,
        `                    vbox:`,
        `                        xsize ${avatarSize}`,
        `                        spacing 6`,
        `                        if _rs_avatar(h.who):`,
        `                            add _rs_avatar(h.who) size (${avatarSize}, ${avatarSize})`,
        `                        text h.who color _rs_name_color(h.who) size ${nameSize - 4}`,
        `                text h.what color ${textColor} size ${textSize - 4}`
      ]
      // 当前对白不单独显示，而是追加在历史文本下方，随历史一起滚动
      if (el.props.showCurrent === true) {
        lines.push(
          `        if what:`,
          `            hbox:`,
          `                spacing 24`,
          `                if who:`,
          `                    vbox:`,
          `                        xsize ${avatarSize}`,
          `                        spacing 6`,
          `                        if _rs_avatar(who):`,
          `                            add _rs_avatar(who) size (${avatarSize}, ${avatarSize})`,
          `                        text who color _rs_name_color(who) size ${nameSize}`,
          `            text what color ${textColor} size ${textSize}`
        )
      }
      return lines
    }
    case 'text':
    case 'paragraph':
      return [`text ${q(String(el.props.text ?? ''))}:`, `    ${posProps}`, `    color ${q(String(s.color ?? '#fff'))}`, `    size ${s.fontSize ?? 28}`]
    case 'button':
      return [`textbutton ${q(String(el.props.text ?? ''))}:`, `    ${posProps}`]
    case 'variable-panel': {
      const showGlobal = el.props.showGlobal !== false
      const showLocal = el.props.showLocal !== false
      const vars = variables.filter((v) => (showGlobal && v.scope === 'global') || (showLocal && v.scope === 'local'))
      const lines: string[] = [`vbox:`, `    ${posProps}`, `    spacing 8`]
      for (const v of vars) {
        const varName = sanitizeVar(v.varName || v.name)
        if (!varName) continue
        // 只显示变量值，不显示变量名（变量名对玩家不可见）
        lines.push(`    text ${q('[' + varName + ']')}`)
      }
      if (vars.length === 0) {
        lines.push(`    text ${q('（无变量）')}`)
      }
      return lines
    }
    case 'variable-value': {
      const v = variables.find((x) => x.id === String(el.props.variableId))
      const varName = sanitizeVar(v ? v.varName || v.name : '')
      if (!varName) return [`## 变量值（未选择变量）: ${posProps}`]
      // 单个变量值：用 rect 定位尺寸，文本插值 [varName] 显示实时数值/字符串
      return [`text ${q('[' + varName + ']')}:`, `    ${posProps}`, `    color ${q(String(s.color ?? '#fff'))}`, `    size ${s.fontSize ?? 32}`]
    }
    case 'shop-list': {
      // source = 'inventory' -> 背包（显示数量，点击使用）；'shop' -> 商品（显示价格，点击购买）
      const isInventory = String(el.props.source ?? 'shop') === 'inventory'
      if (isInventory) {
        return [
          `viewport:`,
          `    ${posProps}`,
          `    mousewheel True`,
          `    vbox:`,
          `        spacing 8`,
          `        for item in player_inventory.get_items(filter_empty=True):`,
          `            textbutton ${q('[item.name]　×[player_inventory.get_num_item(item)]')} action Show('use_item_screen', item=item)`
        ]
      }
      return [
        `viewport:`,
        `    ${posProps}`,
        `    mousewheel True`,
        `    vbox:`,
        `        spacing 8`,
        `        for item in toy_store.get_stock():`,
        `            textbutton ${q('[item.name]　[item.price]金币')} action Call('checkout', item=item)`
      ]
    }
    case 'cg-gallery': {
      // CG 鉴赏：用运行时导出的 _rs_cgs 列表 + Gallery 对象 g 生成缩略图网格。
      // 未解锁显示暗色缩略图，已解锁点击后查看大图。
      const cols = Number(el.props.cols ?? 4)
      const rows = Number(el.props.rows ?? 2)
      const gap = Number(el.props.gap ?? 20)
      const cgCount = scenes.filter((s) => s.layers.some((l) => l.assetPath)).length
      if (cgCount === 0) return [`## CG 鉴赏（暂无 CG，请在「场景」页添加）: ${posProps}`]
      return [
        `grid ${cols} ${rows}:`,
        `    ${posProps}`,
        `    spacing ${gap}`,
        `    for _name, _img in _rs_cgs:`,
        `        add g.make_button(_name, unlocked=im.Scale(_img, 360, 200), locked=im.MatrixColor(im.Scale(_img, 360, 200), im.matrix.brightness(-0.7)))`
      ]
    }
    case 'date-display':
      return [`text _rs_date_str():`, `    ${posProps}`, `    color ${q(String(s.color ?? '#fff'))}`, `    size ${s.fontSize ?? 28}`]
    case 'world-map':
      // 大地图：交给 worldmap.rpy 里的 _RS_WorldMap 自定义 displayable 渲染（缩放/拖拽/边缘滚动/点击移动）
      return [`add _RS_WorldMap()`]
    case 'newspaper-button':
      return [`textbutton ${q(String(el.props.text ?? '📰 日报'))} action Show(${q('newspaper')}):`, `    ${posProps}`]
    case 'newspaper-panel': {
      const name = String(el.props.newspaperName ?? '每日日报')
      const largeSize = Number(el.props.largeSize ?? 34)
      const smallSize = Number(el.props.smallSize ?? 24)
      const color = q(String(s.color ?? '#3a2f1f'))
      return [
        `vbox:`,
        `    ${posProps}`,
        `    spacing 12`,
        `    text ${q(name)} color ${color} size ${largeSize + 14} bold True xalign 0.5`,
        `    null height 1`,
        `    for _n in _rs_today_news:`,
        `        if _n['size'] == 'large':`,
        `            vbox:`,
        `                spacing 4`,
        `                text _n['title'] color ${color} size ${largeSize} bold True`,
        `                if _n['body']:`,
        `                    text _n['body'] color ${color} size ${smallSize - 4}`,
        `        else:`,
        `            hbox:`,
        `                spacing 8`,
        `                text "·" color ${color} size ${smallSize}`,
        `                text _n['title'] color ${color} size ${smallSize}`
      ]
    }
    default:
      return [`## ${el.type} (${el.name})  ${posProps}`]
  }
}

/** 把脚本块转成 Ren'Py 语句 */
export function exportScript(project: Project): string {
  const lines: string[] = []
  lines.push('## 脚本 (由 Richard Studio 生成)')
  lines.push('')
  lines.push('## 角色定义')
  for (const c of project.characters) {
    const safe = c.name.replace(/[^A-Za-z0-9_]/g, '_')
    lines.push(`define ${safe} = Character(${q(c.name)}, color=${q(c.themeColor.fg)})`)
  }
  lines.push('')
  lines.push('## 立绘 / 皮肤图片定义')
  lines.push(...characterImageDefLines(project))
  lines.push('')

  // 成就系统：变量为 True 时自动解锁
  if (project.achievements.length > 0) {
    lines.push(...exportAchievements(project).split('\n'))
  }

  for (const chapter of project.chapters) {
    for (const frag of chapter.fragments) {
      lines.push(`label ${frag.name}:`)
      for (const b of frag.blocks) {
        lines.push(...exportBlock(b, project))
      }
      lines.push('    return')
      lines.push('')
    }
  }
  return lines.join('\n')
}

/** 立绘（表情）与皮肤图片定义：皮肤作为立绘的附加属性，show 时叠加即可 */
function characterImageDefLines(project: Project): string[] {
  const lines: string[] = []
  for (const c of project.characters) {
    const tag = c.name.replace(/[^A-Za-z0-9_]/g, '_')
    for (const ex of c.expressions) {
      const expr = ex.name.replace(/[^A-Za-z0-9_]/g, '_')
      if (ex.assetPath) lines.push(`image ${tag} ${expr} = ${q(ex.assetPath)}`)
      for (const sk of ex.skins) {
        const skin = sk.name.replace(/[^A-Za-z0-9_]/g, '_')
        if (sk.assetPath) lines.push(`image ${tag} ${expr} ${skin} = ${q(sk.assetPath)}`)
      }
    }
  }
  return lines
}

/** 角色定义：生成 define 语句 + 立绘/皮肤 image 定义（保存脚本时写回 characters.rpy） */
export function exportCharacters(project: Project): string {
  const lines: string[] = ['## 角色定义 (由 Richard Studio 生成)']
  for (const c of project.characters) {
    const safe = c.name.replace(/[^A-Za-z0-9_]/g, '_')
    lines.push(`define ${safe} = Character(${q(c.name)}, color=${q(c.themeColor.fg)})`)
  }
  lines.push('')
  lines.push('## 立绘 / 皮肤图片定义')
  lines.push(...characterImageDefLines(project))
  lines.push('')
  return lines.join('\n')
}

// 界面 key → Ren'Py screen 名（导出/保存时用）
const SCREEN_NAME_MAP: Record<string, string> = {
  'dialogue-box': 'say',
  'variable-hud': 'hud',
  'title-screen': 'main_menu',
  'history-screen': 'history',
  'save-screen': 'file_slots',
  'settings-screen': 'preferences',
  'shop-screen': 'shop_menu',
  'newspaper-screen': 'newspaper',
  'map-screen': 'worldmap',
  'gallery-screen': 'gallery',
  'achievement-screen': 'achievements',
  'dictionary-popup': 'dictionary'
}

/** 所有界面 screen 定义（保存时写回 screens.rpy） */
export function exportScreens(project: Project): string {
  const lines: string[] = ['## 界面 screen 定义 (由 Richard Studio 生成)']
  for (const [key, screen] of Object.entries(project.uiScreens)) {
    lines.push(exportScreen(screen, SCREEN_NAME_MAP[key] ?? screen.name, project.variables, project.scenes))
  }
  return lines.join('\n')
}

/** 成就系统代码：变量为 True 时自动解锁（写入 achievements.rpy） */
export function exportAchievements(project: Project): string {
  const lines: string[] = []
  lines.push('## ============================================================')
  lines.push('## 成就系统：变量为 True 时自动解锁')
  lines.push('## ============================================================')
  lines.push('')
  lines.push('## 成就触发变量（玩家不可见），脚本中 $ 变量 = True 即可解锁')
  for (const a of project.achievements) {
    if (a.variable.trim()) lines.push(`default ${sanitizeVar(a.variable)} = False`)
  }
  lines.push('')
  lines.push('init python:')
  lines.push('    ## 变量 -> (成就名, 说明, 是否隐藏)')
  lines.push('    _rs_ACHIEVEMENTS = {')
  for (const a of project.achievements) {
    if (!a.variable.trim()) continue
    lines.push(`        ${q(a.variable)}: (${q(a.name)}, ${q(a.description)}, ${a.hidden ? 'True' : 'False'}),`)
  }
  lines.push('    }')
  lines.push('')
  lines.push('    def _rs_check_achievements():')
  lines.push('        for _var, (_name, _desc, _hidden) in _rs_ACHIEVEMENTS.items():')
  lines.push('            if getattr(store, _var, False):')
  lines.push('                ## 已解锁则跳过；否则弹提示并记录')
  lines.push('                renpy.notify("成就解锁：" + _name)')
  lines.push('')
  return lines.join('\n')
}

/** 场景图片定义（写入 scenes.rpy） */
export function exportScenes(project: Project): string {
  const lines: string[] = ['## 场景定义 (由 Richard Studio 生成)']
  for (const s of project.scenes) {
    for (const layer of s.layers) {
      if (!layer.assetPath) continue
      const tag = layer.assetPath.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_ ]/g, '').replace(/ /g, '_')
      lines.push(`image ${tag} = ${q(layer.assetPath)}`)
    }
  }
  lines.push('')
  return lines.join('\n')
}

/** CG 鉴赏运行时（写入 gallery.rpy）：Gallery 对象 + 每张 CG 的解锁条件 / 大图。
 *  每张 CG 对应一个「场景」的背景图，玩家在游戏里看到过该背景即自动解锁。 */
export function exportGallery(project: Project): string {
  const lines: string[] = []
  lines.push('## CG 鉴赏（由 Richard Studio 生成）')
  lines.push('## 每张 CG 对应一个「场景」的背景图；在游戏里看到过该背景即自动解锁。')
  lines.push('init python:')
  lines.push('    g = Gallery()')
  lines.push('    g.transition = dissolve')
  lines.push('    _rs_cgs = [')
  const cgs = project.scenes.filter((s) => s.layers.some((l) => l.assetPath))
  cgs.forEach((s, i) => {
    const img = s.layers.find((l) => l.assetPath)!.assetPath
    lines.push(`        (${q('cg_' + i)}, ${q(img)}),`)
  })
  lines.push('    ]')
  lines.push('')
  lines.push('    for _name, _img in _rs_cgs:')
  lines.push('        g.button(_name)')
  lines.push('        g.unlock_image(_img)')
  lines.push('        g.image(_img)')
  lines.push('')
  return lines.join('\n')
}

/** 辞典专有名词（写入 dictionary.rpy） */
export function exportDictionary(project: Project): string {
  const lines: string[] = ['## 辞典（专有名词解释，由 Richard Studio 生成）']
  lines.push('init python:')
  lines.push('    _rs_DICTIONARY = [')
  for (const d of project.dictionary) {
    lines.push(`        (${q(d.term)}, ${q(d.aliases)}, ${q(d.image)}, ${q(d.text)}),`)
  }
  lines.push('    ]')
  lines.push('')
  return lines.join('\n')
}

/** 变量定义（写入 variables.rpy）：全局/局部变量都用 default 声明并赋初值 */
export function exportVariables(project: Project): string {
  const lines: string[] = ['## 变量定义 (由 Richard Studio 生成)']
  for (const v of project.variables) {
    const varName = sanitizeVar(v.varName || v.name)
    if (!varName) continue
    lines.push(`default ${varName} = ${formatVariableValue(v)}`)
  }
  lines.push('')
  return lines.join('\n')
}

function formatVariableValue(v: GameVariable): string {
  if (v.type === 'string') return q(v.value)
  if (v.type === 'boolean') return v.value === 'true' || v.value === 'True' || v.value === '1' ? 'True' : 'False'
  const n = Number(v.value)
  return Number.isFinite(n) && v.value !== '' ? String(n) : (v.value || '0')
}

/** 运行时辅助（写入 runtime.rpy）：头像 / 角色名颜色映射。
 *  历史直接用 Ren'Py 内置的 _history_list，无需自定义记录。 */
export function exportRuntime(project: Project): string {
  const lines: string[] = ['## 运行时辅助（由 Richard Studio 生成）']
  lines.push('init python:')
  lines.push('    ## 头像映射：角色显示名 -> 图片路径（优先独立头像，否则取第一个立绘）')
  lines.push('    _rs_avatars = {')
  for (const c of project.characters) {
    const avatar = c.avatar || c.expressions[0]?.assetPath
    if (avatar) lines.push(`        ${q(c.name)}: ${q(avatar)},`)
  }
  lines.push('    }')
  lines.push('')
  lines.push('    ## 角色名颜色映射：角色显示名 -> 主题前景色')
  lines.push('    _rs_name_colors = {')
  for (const c of project.characters) {
    lines.push(`        ${q(c.name)}: ${q(c.themeColor.fg)},`)
  }
  lines.push('    }')
  lines.push('')
  lines.push('    def _rs_avatar(who):')
  lines.push('        return _rs_avatars.get(who, None)')
  lines.push('')
  lines.push('    def _rs_name_color(who):')
  lines.push('        return _rs_name_colors.get(who, "#ffffff")')
  lines.push('')
  lines.push('## 合并样式选择支：menu 选项以旁白序号（1. 2. 3.）呈现，悬停变色')
  lines.push('screen choice(items):')
  lines.push('    vbox:')
  lines.push('        spacing 12')
  lines.push('        for i in items:')
  lines.push('            textbutton i.caption action i.action text_style "choice_text"')
  lines.push('')
  lines.push('style choice_text:')
  lines.push('    color "#e8edf2"')
  lines.push('    hover_color "#7fd4c8"')
  lines.push('    size 30')
  lines.push('')
  return lines.join('\n')
}

/** 商店 / 背包运行时（写入 shop.rpy）：Item / BoosterItem / Inventory / Shop / Player
 *  + 示例商品 + 购买（金币校验、售罄）/ 使用道具 流程。
 *  参考 Black Pineapple 的商店背包教程（InventoryClass / ItemClass / ShopClass / PlayerClass）。 */
export function exportShop(): string {
  const lines: string[] = []
  lines.push('## ============================================================')
  lines.push('## 商店 / 背包系统（由 Richard Studio 生成）')
  lines.push('## 参考 Black Pineapple 教程，已修正原教程里的若干小问题。')
  lines.push('## ============================================================')
  lines.push('')
  lines.push('init -1 python:')
  lines.push('    from collections import defaultdict')
  lines.push('')
  lines.push('    class Item(object):')
  lines.push('        def __init__(self, name, img):')
  lines.push('            self.name = name')
  lines.push('            self.img = img')
  lines.push('')
  lines.push('        ## 用 Item 做字典键，需要相等/哈希两个方法')
  lines.push('        def __eq__(self, another):')
  lines.push('            return hasattr(another, "name") and self.name == another.name')
  lines.push('')
  lines.push('        def __hash__(self):')
  lines.push('            return hash(self.name)')
  lines.push('')
  lines.push('        def get_icon(self):')
  lines.push('            return self.img')
  lines.push('')
  lines.push('    class BoosterItem(Item):')
  lines.push('        def __init__(self, name, price, description="", booster=None, img=None):')
  lines.push('            super(BoosterItem, self).__init__(name, img or ("images/items/" + name + ".png"))')
  lines.push('            self.description = description')
  lines.push('            self.price = price')
  lines.push('            self.booster = booster or dict()')
  lines.push('')
  lines.push('        ## 使用道具：把 booster 里每个属性加给玩家')
  lines.push('        def use(self, player):')
  lines.push('            for attribute in self.booster:')
  lines.push('                player.increase_by(attribute, self.booster[attribute])')
  lines.push('')
  lines.push('    class Inventory(object):')
  lines.push('        def __init__(self):')
  lines.push('            self.stock = defaultdict(int)')
  lines.push('')
  lines.push('        def add(self, item, count=1):')
  lines.push('            self.stock[item] += count')
  lines.push('')
  lines.push('        def remove(self, item, count=1):')
  lines.push('            if item not in self.stock:')
  lines.push('                raise Exception("背包里没有该物品")')
  lines.push('            if self.stock[item] < count:')
  lines.push('                raise Exception("该物品数量不足")')
  lines.push('            self.stock[item] -= count')
  lines.push('')
  lines.push('        def get_num_item(self, item):')
  lines.push('            return self.stock.get(item, 0)')
  lines.push('')
  lines.push('        def get_items(self, filter_empty=False):')
  lines.push('            if filter_empty:')
  lines.push('                return [x for x in self.stock.keys() if self.stock[x]]')
  lines.push('            return list(self.stock.keys())')
  lines.push('')
  lines.push('    class Shop(object):')
  lines.push('        def __init__(self):')
  lines.push('            self.inventory = Inventory()')
  lines.push('')
  lines.push('        def get_stock(self):')
  lines.push('            return self.inventory.get_items()')
  lines.push('')
  lines.push('        def sell(self, item, count=1):')
  lines.push('            self.inventory.remove(item, count)')
  lines.push('')
  lines.push('        def buy(self, item, count=1):')
  lines.push('            self.inventory.add(item, count)')
  lines.push('')
  lines.push('        def is_sold_out(self, item):')
  lines.push('            return self.inventory.get_num_item(item) == 0')
  lines.push('')
  lines.push('        def get_number(self, item):')
  lines.push('            return self.inventory.get_num_item(item)')
  lines.push('')
  lines.push('        def refresh(self, stock):')
  lines.push('            self.inventory = Inventory()')
  lines.push('            for item, count in stock:')
  lines.push('                self.buy(item, count)')
  lines.push('')
  lines.push('    class Player(object):')
  lines.push('        def __init__(self, name):')
  lines.push('            self.name = name')
  lines.push('            self.intelligence = 10')
  lines.push('            self.fitness = 5')
  lines.push('            self.charisma = 5')
  lines.push('')
  lines.push('        def increase_by(self, attribute, value):')
  lines.push('            setattr(self, attribute, value + getattr(self, attribute))')
  lines.push('')
  lines.push('        def get(self, attribute):')
  lines.push('            return getattr(self, attribute)')
  lines.push('')
  lines.push('## 商品定义（可自行增删，name 为显示名，booster 为使用后提升的属性）')
  lines.push('define apple = BoosterItem(name="苹果", price=10, description="可以增加{color=#F37459}10点智力{/color}", booster=dict(intelligence=10))')
  lines.push('define orange = BoosterItem(name="橙子", price=18, description="可以增加{color=#F37459}5点魅力{/color}", booster=dict(charisma=5))')
  lines.push('define carrot = BoosterItem(name="胡萝卜", price=18, description="可以增加{color=#F37459}10点身材{/color}", booster=dict(fitness=10))')
  lines.push('define cake = BoosterItem(name="蛋糕", price=30, description="可以增加{color=#F37459}20点身材{/color}", booster=dict(fitness=20))')
  lines.push('define book = BoosterItem(name="书本", price=15, description="可以增加{color=#F37459}10点智力{/color}", booster=dict(intelligence=10))')
  lines.push('define perfume = BoosterItem(name="香水", price=25, description="可以增加{color=#F37459}10点魅力{/color}", booster=dict(charisma=10))')
  lines.push('')
  lines.push('## 商店库存（物品, 数量）')
  lines.push('define TOY_STORE_ITEMS = [')
  lines.push('    (apple, 10),')
  lines.push('    (orange, 10),')
  lines.push('    (carrot, 10),')
  lines.push('    (cake, 5),')
  lines.push('    (book, 5),')
  lines.push('    (perfume, 5),')
  lines.push(']')
  lines.push('')
  lines.push('default player = Player(name="玩家")')
  lines.push('default toy_store = Shop()')
  lines.push('default player_inventory = Inventory()')
  lines.push('')
  lines.push('## 进入商店/背包（脚本中 jump open_shop）')
  lines.push('label open_shop:')
  lines.push('    if not toy_store.get_stock():')
  lines.push('        $ toy_store.refresh(TOY_STORE_ITEMS)')
  lines.push('    show screen shop_menu')
  lines.push('    pause')
  lines.push('    jump open_shop')
  lines.push('    return')
  lines.push('')
  lines.push('## 购买结算：金币校验 + 售罄判断 + 转移商品')
  lines.push('label checkout(item):')
  lines.push('    if toy_store.is_sold_out(item):')
  lines.push('        call screen information(msg="该商品已售罄。")')
  lines.push('        return')
  lines.push('    if player_gold < item.price:')
  lines.push('        call screen information(msg="金币不足。")')
  lines.push('        return')
  lines.push('    python:')
  lines.push('        player_gold -= item.price')
  lines.push('        toy_store.sell(item)')
  lines.push('        player_inventory.add(item)')
  lines.push('    call screen information(msg="购买成功：" + item.name)')
  lines.push('    return')
  lines.push('')
  lines.push('## 使用道具：提升属性并从背包移除')
  lines.push('label use_item(item):')
  lines.push('    python:')
  lines.push('        item.use(player)')
  lines.push('        player_inventory.remove(item)')
  lines.push('    call screen information(msg=item.description)')
  lines.push('    return')
  lines.push('')
  lines.push('## 使用道具确认弹窗')
  lines.push('screen use_item_screen(item):')
  lines.push('    zorder 3')
  lines.push('    frame:')
  lines.push('        align (0.5, 0.5)')
  lines.push('        xysize (460, 320)')
  lines.push('        vbox:')
  lines.push('            spacing 24')
  lines.push('            align (0.5, 0.5)')
  lines.push('            text "是否使用 [item.name]？" color "#fff" size 30')
  lines.push('            text item.description color "#ccc" size 24')
  lines.push('            hbox:')
  lines.push('                spacing 40')
  lines.push('                align (0.5, 0.5)')
  lines.push('                textbutton "使用" action [Hide("use_item_screen"), Call("use_item", item=item)]')
  lines.push('                textbutton "取消" action Hide("use_item_screen")')
  lines.push('')
  lines.push('## 通用信息弹窗（购买成功 / 金币不足 / 售罄等）')
  lines.push('screen information(msg):')
  lines.push('    zorder 3')
  lines.push('    button:')
  lines.push('        xysize (1920, 1080)')
  lines.push('        action Return()')
  lines.push('    frame:')
  lines.push('        align (0.5, 0.5)')
  lines.push('        xysize (460, 260)')
  lines.push('        text msg align (0.5, 0.5) color "#fff" size 26')
  lines.push('')
  return lines.join('\n')
}

/** 由变量 id 解析出合法的 Ren'Py 变量名 */
function resolveVarName(project: Project, id: string): string {
  const v = project.variables.find((x) => x.id === id)
  if (!v) return ''
  return sanitizeVar(v.varName || v.name)
}

/** 日期 / 天气 / 地图 / 日报系统（写入 datesystem.rpy）
 *  运行时日期变量：_rs_year/_rs_month/_rs_day；天气 _rs_weather；地图 _rs_current_map；当天新闻 _rs_today_news。
 *  「结束今天」块调用 _rs_end_day(睡前label)：日期+1 → 重掷天气/地图 → 生成当天新闻 → 跳转到睡前剧情。 */
export function exportDateSystem(project: Project): string {
  const d = project.dateSystem
  const lines: string[] = []
  lines.push('## ============================================================')
  lines.push('## 日期 / 天气 / 地图 / 日报系统（由 Richard Studio 生成）')
  lines.push('## ============================================================')
  lines.push('')
  lines.push(`default _rs_year = ${d.startYear}`)
  lines.push(`default _rs_month = ${d.startMonth}`)
  lines.push(`default _rs_day = ${d.startDay}`)
  lines.push('default _rs_day_count = 0')
  lines.push('default _rs_weather = "sunny"')
  lines.push('default _rs_current_map = ""')
  lines.push('default _rs_today_news = []')
  lines.push('')

  // 地图背景图片定义（天气切换时用）
  const maps = project.weatherMaps.filter((w) => w.mapImage.trim())
  const mapTags: Record<string, string> = {}
  if (maps.length > 0) {
    lines.push('## 天气对应的地图背景')
    maps.forEach((w, i) => {
      const tag = `_rs_map_${i}`
      mapTags[w.mapImage] = tag
      lines.push(`image ${tag} = ${q(w.mapImage)}`)
    })
    lines.push('')
  }

  lines.push('init python:')
  lines.push('    import calendar')
  lines.push('')
  lines.push('    ## 天气/地图规则：name / effect / trigger(变量名或None) / weight / map(图片标签或None)')
  lines.push('    _rs_WEATHERS = [')
  for (const w of project.weatherMaps) {
    const trig = w.triggerVariableId ? resolveVarName(project, w.triggerVariableId) : ''
    const mapTag = w.mapImage.trim() ? (mapTags[w.mapImage] || w.mapImage) : ''
    lines.push(`        {'name': ${q(w.name)}, 'effect': ${q(w.effect)}, 'trigger': ${trig ? q(trig) : 'None'}, 'weight': ${w.weight}, 'map': ${mapTag ? q(mapTag) : 'None'}},`)
  }
  lines.push('    ]')
  lines.push('')
  lines.push('    ## 日报新闻：title / body / size / trigger(变量名或None) / weight')
  lines.push('    _rs_NEWS = [')
  for (const n of project.news) {
    const trig = n.triggerVariableId ? resolveVarName(project, n.triggerVariableId) : ''
    lines.push(`        {'title': ${q(n.title)}, 'body': ${q(n.body)}, 'size': ${q(n.size)}, 'trigger': ${trig ? q(trig) : 'None'}, 'weight': ${n.weight}},`)
  }
  lines.push('    ]')
  lines.push('')
  lines.push('    def _rs_days_in_month(y, m):')
  lines.push('        return calendar.monthrange(y, m)[1]')
  lines.push('')
  lines.push('    def _rs_date_str():')
  lines.push('        return "公历%d年%d月%d日" % (_rs_year, _rs_month, _rs_day)')
  lines.push('')
  lines.push('    ## 掷天气：优先取触发变量为真的规则，否则按权重随机')
  lines.push('    def _rs_roll_weather():')
  lines.push('        for _w in _rs_WEATHERS:')
  lines.push('            if _w["trigger"] and getattr(store, _w["trigger"], False):')
  lines.push('                return _w')
  lines.push('        _pool = [_w for _w in _rs_WEATHERS if _w["weight"] > 0]')
  lines.push('        if not _pool:')
  lines.push('            return _rs_WEATHERS[0]')
  lines.push('        _total = sum(_w["weight"] for _w in _pool)')
  lines.push('        _r = renpy.random.randint(1, _total)')
  lines.push('        _acc = 0')
  lines.push('        for _w in _pool:')
  lines.push('            _acc += _w["weight"]')
  lines.push('            if _r <= _acc:')
  lines.push('                return _w')
  lines.push('        return _pool[-1]')
  lines.push('')
  lines.push('    ## 应用天气：切换天气 + 地图背景 + 雨/雪特效')
  lines.push('    def _rs_apply_weather(_w):')
  lines.push('        store._rs_weather = _w["effect"]')
  lines.push('        store._rs_current_map = _w["map"] or ""')
  lines.push('        if _w["map"]:')
  lines.push('            renpy.scene()')
  lines.push('            renpy.show(_w["map"])')
  lines.push('        renpy.hide_screen("_rs_weather_fx")')
  lines.push('        if _w["effect"] == "snow":')
  lines.push('            renpy.show_screen("_rs_weather_fx", kind="snow")')
  lines.push('        elif _w["effect"] == "rain":')
  lines.push('            renpy.show_screen("_rs_weather_fx", kind="rain")')
  lines.push('')
  lines.push('    ## 生成当天新闻：变量触发强制出现，否则按权重随机出现')
  lines.push('    def _rs_gen_news():')
  lines.push('        _out = []')
  lines.push('        for _n in _rs_NEWS:')
  lines.push('            if _n["trigger"]:')
  lines.push('                if getattr(store, _n["trigger"], False):')
  lines.push('                    _out.append(_n)')
  lines.push('            elif renpy.random.randint(1, 100) <= _n["weight"]:')
  lines.push('                _out.append(_n)')
  lines.push('        return _out')
  lines.push('')
  lines.push('## 雨/雪天气特效')
  lines.push('screen _rs_weather_fx(kind="snow"):')
  lines.push('    zorder 200')
  lines.push('    if kind == "rain":')
  lines.push('        ## 用雪花图快速下落模拟雨点，可换成雨滴图片')
  lines.push('        add SnowBlossom("snow", count=140, fast=True, vertical_speed=240)')
  lines.push('    else:')
  lines.push('        add SnowBlossom("snow")')
  lines.push('')
  lines.push('## 结束今天：日期+1 → 重掷天气/地图 → 生成当天新闻 → 跳转到睡前剧情 label')
  lines.push('label _rs_end_day(sleep_label=None):')
  lines.push('    python:')
  lines.push('        _rs_day += 1')
  lines.push('        if _rs_day > _rs_days_in_month(_rs_year, _rs_month):')
  lines.push('            _rs_day = 1')
  lines.push('            _rs_month += 1')
  lines.push('            if _rs_month > 12:')
  lines.push('                _rs_month = 1')
  lines.push('                _rs_year += 1')
  lines.push('        _rs_day_count += 1')
  lines.push('        _rs_apply_weather(_rs_roll_weather())')
  lines.push('        _rs_today_news = _rs_gen_news()')
  lines.push('    if sleep_label:')
  lines.push('        call expression sleep_label')
  lines.push('    return')
  lines.push('')
  return lines.join('\n')
}

/** 大地图系统（写入 worldmap.rpy）
 *  生成一个自定义 displayable（_RS_WorldMap），实现：
 *   滚轮缩放（以鼠标为中心）、左键拖拽平移、边缘自动滚动、
 *   地点悬停气泡、点击跳转 label、玩家标识 + 移动虚线。
 *  运行时玩家所在地点存 _rs_player_location，相机状态存 _rs_map_cam。 */
export function exportWorldMap(project: Project): string {
  const m = project.worldMap
  const lines: string[] = []
  lines.push('## ============================================================')
  lines.push('## 大地图系统（由 Richard Studio 生成）')
  lines.push('## 滚轮缩放（以鼠标为中心）、左键拖拽平移、边缘自动滚动、')
  lines.push('## 地点悬停气泡、点击跳转 label、玩家标识与移动虚线。')
  lines.push('## 运行时：show screen worldmap 显示；地点点击跳转其 targetLabel。')
  lines.push('## ============================================================')
  lines.push('')

  const bgTag = '_rs_mapbg'
  const markerTag = '_rs_mapmarker'
  const locTags: Record<string, string> = {}
  let anyImg = false
  if (m.backgroundImage) {
    lines.push(`image ${bgTag} = ${q(m.backgroundImage)}`)
    anyImg = true
  }
  if (m.playerMarkerImage) {
    lines.push(`image ${markerTag} = ${q(m.playerMarkerImage)}`)
    anyImg = true
  }
  m.locations.forEach((loc, i) => {
    if (loc.image) {
      const t = `_rs_loc_${i}`
      locTags[loc.id] = t
      lines.push(`image ${t} = ${q(loc.image)}`)
      anyImg = true
    }
  })
  if (anyImg) lines.push('')

  lines.push(`default _rs_player_location = ${q(m.playerLocationId)}`)
  lines.push('default _rs_map_cam = {"zoom": 1.0, "cx": None, "cy": None}')
  lines.push('')
  lines.push('init python:')
  lines.push('    import math')
  lines.push('    import pygame')
  lines.push('    from renpy.text.text import Text')
  lines.push('')
  lines.push('    _rs_MAP_CFG = {')
  lines.push(`        "image": ${m.backgroundImage ? q(bgTag) : 'None'},`)
  lines.push(`        "w": ${m.width}, "h": ${m.height},`)
  lines.push(`        "marker": ${m.playerMarkerImage ? q(markerTag) : 'None'},`)
  lines.push(`        "edge": ${m.edgeScrollMargin},`)
  lines.push(`        "min_zoom": ${m.minZoom}, "max_zoom": ${m.maxZoom},`)
  lines.push('    }')
  lines.push('')
  lines.push('    _rs_MAP_LOCATIONS = [')
  for (const loc of m.locations) {
    const img = locTags[loc.id] ? q(locTags[loc.id]) : 'None'
    lines.push(`        {"id": ${q(loc.id)}, "name": ${q(loc.name)}, "img": ${img}, "tooltip": ${q(loc.tooltip)}, "label": ${q(loc.targetLabel)}, "x": ${loc.x}, "y": ${loc.y}, "icon_w": ${loc.iconWidth}},`)
  }
  lines.push('    ]')
  lines.push('')
  lines.push(WORLDMAP_CLASS)
  return lines.join('\n')
}

/** 大地图自定义 displayable 类（init python 内、已带 4 空格缩进） */
const WORLDMAP_CLASS = `    class _RS_WorldMap(renpy.Displayable):
        def __init__(self, **kwargs):
            super(_RS_WorldMap, self).__init__(**kwargs)
            self.zoom = _rs_map_cam.get("zoom") or 1.0
            self.cx = _rs_map_cam.get("cx")
            if self.cx is None:
                self.cx = _rs_MAP_CFG["w"] / 2.0
            self.cy = _rs_map_cam.get("cy")
            if self.cy is None:
                self.cy = _rs_MAP_CFG["h"] / 2.0
            self.vw = 1280
            self.vh = 720
            self.dragging = False
            self.drag_sx = self.drag_sy = 0
            self.drag_cx = self.drag_cy = 0
            self.hover_id = None
            self.travel_from = None
            self.travel_to = None
            self.travel_t = 0.0
            self._bg = _rs_MAP_CFG["image"] and renpy.displayable(_rs_MAP_CFG["image"])
            self._marker = _rs_MAP_CFG["marker"] and renpy.displayable(_rs_MAP_CFG["marker"])
            for _loc in _rs_MAP_LOCATIONS:
                _loc["_disp"] = _loc["img"] and renpy.displayable(_loc["img"])

        def _save_cam(self):
            _rs_map_cam["zoom"] = self.zoom
            _rs_map_cam["cx"] = self.cx
            _rs_map_cam["cy"] = self.cy

        def _clamp(self):
            _w = _rs_MAP_CFG["w"]
            _h = _rs_MAP_CFG["h"]
            _hw = self.vw / (2.0 * self.zoom)
            _hh = self.vh / (2.0 * self.zoom)
            if _w > 2 * _hw:
                self.cx = min(max(self.cx, _hw), _w - _hw)
            else:
                self.cx = _w / 2.0
            if _h > 2 * _hh:
                self.cy = min(max(self.cy, _hh), _h - _hh)
            else:
                self.cy = _h / 2.0
            self._save_cam()

        def _find(self, _id):
            for _loc in _rs_MAP_LOCATIONS:
                if _loc["id"] == _id:
                    return _loc
            return None

        def _hit(self, _sx, _sy):
            _r = 28.0
            _mx = self.cx + (_sx - self.vw / 2.0) / self.zoom
            _my = self.cy + (_sy - self.vh / 2.0) / self.zoom
            for _loc in _rs_MAP_LOCATIONS:
                if abs(_mx - _loc["x"]) <= _r and abs(_my - _loc["y"]) <= _r:
                    return _loc
            return None

        def _travel(self, _loc):
            _cur = self._find(store._rs_player_location)
            if _cur is not None:
                self.travel_from = {"x": _cur["x"], "y": _cur["y"]}
            else:
                self.travel_from = {"x": _loc["x"], "y": _loc["y"]}
            self.travel_to = _loc
            self.travel_t = 0.0
            store._rs_player_location = _loc["id"]
            renpy.redraw(self, 0.05)
            if _loc["label"]:
                def _go():
                    renpy.call(_loc["label"])
                renpy.run(_go)

        def event(self, ev, x, y, st):
            if ev.type == pygame.MOUSEMOTION:
                if self.dragging:
                    self.cx = self.drag_cx - (x - self.drag_sx) / self.zoom
                    self.cy = self.drag_cy - (y - self.drag_sy) / self.zoom
                    self._clamp()
                    renpy.redraw(self, 0)
                else:
                    _m = _rs_MAP_CFG["edge"]
                    _dx = _dy = 0
                    if x < _m:
                        _dx = -1
                    elif x > self.vw - _m:
                        _dx = 1
                    if y < _m:
                        _dy = -1
                    elif y > self.vh - _m:
                        _dy = 1
                    if _dx or _dy:
                        self.cx += _dx * 10.0 / self.zoom
                        self.cy += _dy * 10.0 / self.zoom
                        self._clamp()
                        renpy.redraw(self, 0)
                    _h = self._hit(x, y)
                    _nid = _h["id"] if _h is not None else None
                    if _nid != self.hover_id:
                        self.hover_id = _nid
                        renpy.redraw(self, 0)
                raise renpy.IgnoreEvent()
            elif ev.type == pygame.MOUSEBUTTONDOWN:
                if ev.button == 1:
                    self.dragging = True
                    self.drag_sx, self.drag_sy = x, y
                    self.drag_cx, self.drag_cy = self.cx, self.cy
                    raise renpy.IgnoreEvent()
                elif ev.button in (4, 5):
                    _f = 1.1 if ev.button == 4 else 1.0 / 1.1
                    _nz = self.zoom * _f
                    _nz = min(_rs_MAP_CFG["max_zoom"], max(_rs_MAP_CFG["min_zoom"], _nz))
                    _mx = self.cx + (x - self.vw / 2.0) / self.zoom
                    _my = self.cy + (y - self.vh / 2.0) / self.zoom
                    self.zoom = _nz
                    self.cx = _mx - (x - self.vw / 2.0) / _nz
                    self.cy = _my - (y - self.vh / 2.0) / _nz
                    self._clamp()
                    renpy.redraw(self, 0)
                    raise renpy.IgnoreEvent()
            elif ev.type == pygame.MOUSEBUTTONUP and ev.button == 1:
                _was = self.dragging
                self.dragging = False
                if _was:
                    _ddx = x - self.drag_sx
                    _ddy = y - self.drag_sy
                    if _ddx * _ddx + _ddy * _ddy <= 16:
                        _loc = self._hit(x, y)
                        if _loc is not None:
                            self._travel(_loc)
                raise renpy.IgnoreEvent()
            return None

        def _blit_center(self, rv, disp, sx, sy, st, at, size):
            _r = renpy.render(disp, size, size, st, at)
            rv.blit(_r, (int(sx - size / 2), int(sy - size / 2)))

        def render(self, width, height, st, at):
            self.vw = width
            self.vh = height
            self._clamp()
            rv = renpy.Render(width, height)
            _zoom = self.zoom
            _bx = -(self.cx * _zoom) + width / 2.0
            _by = -(self.cy * _zoom) + height / 2.0
            if self._bg is not None:
                _bw = int(_rs_MAP_CFG["w"] * _zoom)
                _bh = int(_rs_MAP_CFG["h"] * _zoom)
                _br = renpy.render(self._bg, _bw, _bh, st, at)
                rv.blit(_br, (int(_bx), int(_by)))
            for _loc in _rs_MAP_LOCATIONS:
                _sx = _loc["x"] * _zoom + _bx
                _sy = _loc["y"] * _zoom + _by
                if _loc.get("_disp") is not None:
                    _iw = _loc["icon_w"] or 48
                    _ir = renpy.render(_loc["_disp"], int(_iw * _zoom), int(_iw * _zoom), st, at)
                    rv.blit(_ir, (int(_sx - _iw * _zoom / 2), int(_sy - _iw * _zoom / 2)))
                else:
                    self._blit_center(rv, Text("●", color="#7fd4c8"), _sx, _sy, st, at, max(12, int(20 * _zoom)))
                if _loc["id"] == self.hover_id:
                    self._blit_center(rv, Text("○", color="#ffffff"), _sx, _sy, st, at, max(16, int(44 * _zoom)))
            if self.travel_to is not None and self.travel_from is not None:
                self._draw_path(rv, _bx, _by, _zoom, st, at)
            _cur = self._find(store._rs_player_location)
            if _cur is not None:
                _px = _cur["x"] * _zoom + _bx
                _py = _cur["y"] * _zoom + _by
                if self._marker is not None:
                    _mw = int(44 * _zoom)
                    _mr = renpy.render(self._marker, _mw, _mw, st, at)
                    rv.blit(_mr, (int(_px - _mw / 2), int(_py - _mw / 2)))
                else:
                    _ps = max(12, int((16 + 3 * math.sin(st * 4.0)) * _zoom))
                    self._blit_center(rv, Text("●", color="#ffd88a"), _px, _py, st, at, _ps)
                    renpy.redraw(self, 0.1)
            if self.hover_id is not None:
                _hloc = self._find(self.hover_id)
                if _hloc is not None and _hloc["tooltip"]:
                    self._draw_tooltip(rv, _hloc, _bx, _by, _zoom, st, at)
            return rv

        def _draw_path(self, rv, _bx, _by, _zoom, st, at):
            _fx = self.travel_from["x"] * _zoom + _bx
            _fy = self.travel_from["y"] * _zoom + _by
            _tx = self.travel_to["x"] * _zoom + _bx
            _ty = self.travel_to["y"] * _zoom + _by
            _mx = (_fx + _tx) / 2.0
            _my = (_fy + _ty) / 2.0
            _ddx = _tx - _fx
            _ddy = _ty - _fy
            _ln = math.hypot(_ddx, _ddy) or 1.0
            _sag = min(_ln * 0.25, 160.0)
            _cxp = _mx - (_ddy / _ln) * _sag
            _cyp = _my + (_ddx / _ln) * _sag
            _dot = Text("●", color="#ffffff")
            _dr = renpy.render(_dot, 24, 24, st, at)
            _phase = int(self.travel_t * 10.0) % 2
            for _i in range(30):
                _t = _i / 29.0
                _a = (1 - _t) * (1 - _t)
                _b = 2 * (1 - _t) * _t
                _c = _t * _t
                _px = _a * _fx + _b * _cxp + _c * _tx
                _py = _a * _fy + _b * _cyp + _c * _ty
                if (_i + _phase) % 2 == 0:
                    rv.blit(_dr, (int(_px - 12), int(_py - 12)))
            self.travel_t += 0.05
            if self.travel_t < 1.6:
                renpy.redraw(self, 0.05)
            else:
                self.travel_from = None
                self.travel_to = None

        def _draw_tooltip(self, rv, _loc, _bx, _by, _zoom, st, at):
            _sx = _loc["x"] * _zoom + _bx
            _sy = _loc["y"] * _zoom + _by
            _tr = renpy.render(Text(_loc["tooltip"], size=22, color="#ffffff", text_align=0.5, outlines=[(1, "#000000", 0, 0)]), 400, 60, st, at)
            _tw, _th = _tr.get_size()
            rv.blit(_tr, (int(_sx - _tw / 2), int(_sy - _th - 26 * _zoom)))
`

/** 单个章节（.rpy 文件）的脚本：label + 块 + return */
export function exportChapter(chapter: Chapter, project: Project): string {
  const lines: string[] = []
  for (const frag of chapter.fragments) {
    lines.push(`label ${frag.name}:`)
    for (const b of frag.blocks) {
      lines.push(...exportBlock(b, project))
    }
    lines.push('    return')
    lines.push('')
  }
  return lines.join('\n')
}

const VAR_OPERATORS: Record<string, string> = {
  set: '=',
  add: '+=',
  subtract: '-=',
  multiply: '*=',
  divide: '/='
}

function exportBlock(b: Block, project: Project): string[] {
  const p = b.props
  const indent = '    '
  switch (b.type) {
    case 'dialogue': {
      const c = project.characters.find((x) => x.id === String(p.characterId))
      const whoVar = c ? c.name.replace(/[^A-Za-z0-9_]/g, '_') : ''
      const text = b.content?.map((x) => x.text).join('') ?? ''
      if (whoVar) return [`${indent}${whoVar} ${q(text)}`]
      return [`${indent}${q(text)}`]
    }
    case 'narration': {
      const text = b.content?.map((x) => x.text).join('') ?? ''
      return [`${indent}${q(text)}`]
    }
    case 'scene': {
      const img = String(p.sceneImage ?? '') || 'bg'
      const tag = img.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_ ]/g, '').replace(/ /g, '_')
      return [`${indent}scene ${tag}`]
    }
    case 'showCharacter': {
      const c = project.characters.find((x) => x.id === String(p.characterId))
      if (!c) return [`${indent}## showCharacter`]
      const tag = c.name.replace(/[^A-Za-z0-9_]/g, '_')
      const expr = String(p.expression ?? '').replace(/[^A-Za-z0-9_]/g, '_')
      const skin = String(p.skin ?? '').replace(/[^A-Za-z0-9_]/g, '_')
      const at = p.position ? ` at ${p.position}` : ''
      const attrs = [expr, skin].filter(Boolean).join(' ')
      return [`${indent}show ${tag} ${attrs}${at}`]
    }
    case 'removeCharacter': {
      const c = project.characters.find((x) => x.id === String(p.characterId))
      if (!c) return [`${indent}## hide`]
      return [`${indent}hide ${c.name.replace(/[^A-Za-z0-9_]/g, '_')}`]
    }
    case 'showScreen':
      return [`${indent}show screen ${String(p.screenName ?? '')}`]
    case 'wait':
      return [`${indent}pause ${Number(p.duration ?? 1000) / 1000}`]
    case 'sound':
      return [`${indent}play music ${q(String(p.uri ?? ''))}`]
    case 'stopSound':
      return [`${indent}stop music`]
    case 'comment':
      return [`${indent}# ${String(p.text ?? '')}`]
    case 'setver': {
      const v = project.variables.find((x) => x.id === String(p.variableId))
      const varName = sanitizeVar(v ? v.varName || v.name : String(p.name ?? 'x'))
      const op = VAR_OPERATORS[String(p.operation ?? 'set')] ?? '='
      return [`${indent}$ ${varName} ${op} ${String(p.value ?? '0')}`]
    }
    case 'callFragment':
      return [`${indent}jump ${String(p.target ?? '')}`]
    case 'returnToEntry':
      return [`${indent}return`]
    case 'branch':
      return [`${indent}menu:`]
    case 'endDay':
      return [`${indent}call _rs_end_day(${q(String(p.sleepLabel ?? ''))})`]
    case 'diceCheck': {
      const threshold = Number(p.threshold ?? 0)
      const bonus = Number(p.bonus ?? 0)
      const mods = (p.modifiers as { variableId: string; sign: string }[] | undefined) ?? []
      const lines: string[] = []
      lines.push(`${indent}$ _rs_dice = renpy.random.randint(1, 100)`)
      let expr = `_rs_dice + ${bonus}`
      const detail: string[] = [`骰子 = [_rs_dice]`]
      if (bonus) detail.push(`装备加成 = +${bonus}`)
      for (const m of mods) {
        const v = project.variables.find((x) => x.id === m.variableId)
        const varName = sanitizeVar(v ? v.varName || v.name : '')
        if (!varName) continue
        const sign = m.sign === '-' ? '-' : '+'
        expr += ` ${sign} ${varName}`
        detail.push(`${v?.name ?? varName} ${sign} [${varName}]`)
      }
      lines.push(`${indent}$ _rs_total = ${expr}`)
      lines.push(`${indent}$ _rs_verdict = "成功！" if _rs_total >= ${threshold} else "失败…"`)
      lines.push(`${indent}${q(`【检定】` + detail.join(`，`) + `，总值 = [_rs_total]，难度 = ${threshold} —— [_rs_verdict]`)}`)
      lines.push(`${indent}if _rs_total >= ${threshold}:`)
      lines.push(`${indent}    jump ${q(String(p.successLabel ?? ''))}`)
      lines.push(`${indent}else:`)
      lines.push(`${indent}    jump ${q(String(p.failureLabel ?? ''))}`)
      return lines
    }
    case 'mergedChoice': {
      const choices = (p.choices as { text: string; targetLabel: string }[] | undefined) ?? []
      const lines: string[] = [`${indent}menu:`]
      choices.forEach((c, i) => {
        lines.push(`${indent}    ${q(`${i + 1}. ${c.text ?? ''}`)}:`)
        lines.push(`${indent}        jump ${q(c.targetLabel ?? '')}`)
      })
      return lines
    }
    default:
      return [`${indent}## ${b.type}`]
  }
}
