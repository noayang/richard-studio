// ============================================================
// Ren'Py 代码生成器
// 根据 UiConfig 生成一个自包含的 .rpy 文件，实现竖版可滚动对话界面
// ============================================================

import type { UiConfig } from '../types'

/** 转义为 Ren'Py 双引号字符串 */
function q(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 255)})`
}

export function generateRpy(config: UiConfig): string {
  const { textBox, avatar, name, scrollback, screen } = config

  const lines: string[] = []
  lines.push('## ============================================================')
  lines.push('## 竖版对话界面 (由 Richard Studio 生成)')
  lines.push('## 功能：文本框靠右占 1/3、对话可回滚、头像+角色名在左侧并一起上滚')
  lines.push('## 将本文件放入项目的 game/ 目录，或合并进 screens.rpy 即可生效')
  lines.push('## ============================================================')
  lines.push('')

  // ---- init 块：历史记录 + 角色系统 ----
  lines.push('init -2 python:')
  lines.push('    ## 对话历史：每项为 (who, what)')
  lines.push('    _rs_history = []')
  lines.push('')
  lines.push('    ## 头像映射：角色变量名 -> 图片')
  lines.push('    _rs_avatars = {')
  for (const c of config.characters) {
    if (c.avatarTag) {
      lines.push(`        ${q(c.key)}: ${q(c.avatarTag)},`)
    }
  }
  lines.push('    }')
  lines.push('')
  lines.push('    ## 角色名颜色映射：角色变量名 -> 颜色')
  lines.push('    _rs_name_colors = {')
  for (const c of config.characters) {
    if (c.color) {
      lines.push(`        ${q(c.key)}: ${q(c.color)},`)
    }
  }
  lines.push('    }')
  lines.push('')
  lines.push('    ## 记录对话并滚动更新的 Character 子类')
  lines.push('    class RSCharacter(ADVCharacter):')
  lines.push('        def do_say(self, who, what, **kwargs):')
  lines.push('            _rs_history.append((who, what))')
  lines.push(`            if len(_rs_history) > ${scrollback.maxLines}:`)
  lines.push(`                _rs_history = _rs_history[-${scrollback.maxLines}:]`)
  lines.push('            return super(RSCharacter, self).do_say(who, what, **kwargs)')
  lines.push('')
  lines.push('    def RSChar(name, **kwargs):')
  lines.push('        return RSCharacter(name, **kwargs)')
  lines.push('')
  lines.push('    def _rs_avatar(who):')
  lines.push('        return _rs_avatars.get(who, None)')
  lines.push('')
  lines.push('    def _rs_name_color(who):')
  lines.push('        return _rs_name_colors.get(who, "#ffffff")')
  lines.push('')

  // ---- 文本框尺寸 ----
  const boxWidth = Math.round(screen.width * textBox.widthRatio)
  const alignVal = textBox.align === 'right' ? '1.0' : '0.0'
  const yalign = textBox.fullHeight ? '0.5' : '1.0'

  lines.push('## 单条消息气泡：头像在左，角色名+对白在右')
  lines.push('screen rs_bubble(who, what):')
  lines.push('    hbox:')
  lines.push(`        spacing ${avatar.gap}`)
  lines.push('        vbox:')
  if (avatar.enabled) {
    lines.push('            ## 头像 + 角色名 一起的头部')
    lines.push('            hbox:')
    lines.push(`                spacing ${avatar.gap}`)
    lines.push('                if _rs_avatar(who):')
    lines.push('                    add _rs_avatar(who):')
    lines.push(`                        xysize (${avatar.size}, ${avatar.size})`)
    lines.push('                else:')
    lines.push(`                    null width ${avatar.size}`)
    if (name.enabled) {
      lines.push('                if who:')
      lines.push('                    text who:')
      lines.push(`                        size ${name.fontSize}`)
      lines.push('                        color _rs_name_color(who)')
      lines.push('                        yalign 0.5')
    }
    lines.push('            ## 对白')
    lines.push('            text what:')
  } else {
    if (name.enabled) {
      lines.push('            if who:')
      lines.push('                text who:')
      lines.push(`                    size ${name.fontSize}`)
      lines.push('                    color _rs_name_color(who)')
    }
    lines.push('            text what:')
  }
  lines.push(`                size ${textBox.fontSize}`)
  lines.push(`                color ${q(textBox.textColor)}`)
  if (textBox.font) {
    lines.push(`                font ${q(textBox.font)}`)
  }
  lines.push(`                line_spacing ${textBox.lineSpacing}`)
  lines.push('')

  // ---- say screen 覆写 ----
  lines.push('## 覆写默认对话界面')
  lines.push('screen say(who, what):')
  lines.push('    window:')
  lines.push('        id "window"')
  lines.push(`        background Solid(${q(hexToRgba(textBox.bgColor, textBox.bgAlpha))})`)
  lines.push(`        xsize ${boxWidth}`)
  lines.push(`        xalign ${alignVal}`)
  lines.push(`        yalign ${yalign}`)
  lines.push(`        padding (${textBox.padding}, ${textBox.padding})`)
  lines.push('')
  if (scrollback.enabled) {
    lines.push('        ## 可滚动历史视图')
    lines.push('        viewport:')
    lines.push('            id "rs_scroll"')
    lines.push('            mousewheel True')
    lines.push('            draggable True')
    lines.push('            scrollbars "vertical"')
    lines.push('            yinitial 1.0')
    lines.push('            vbox:')
    lines.push('                spacing 16')
    lines.push('                for hwho, hwhat in _rs_history:')
    lines.push('                    use rs_bubble(hwho, hwhat)')
    lines.push('                use rs_bubble(who, what)')
  } else {
    lines.push('        vbox:')
    lines.push('            use rs_bubble(who, what)')
  }
  lines.push('')

  return lines.join('\n')
}
