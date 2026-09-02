import type { PickedAsset } from '../../../shared/types'

// ============================================================
// 通用「选择文件」按钮：点击后弹出文件选择器，直接浏览当前
// Ren'Py 项目的 game 目录并返回所选文件的路径（不复制、不归档）
// ============================================================

export type PickKind = 'image' | 'audio' | 'video' | 'font' | 'any'

export default function AssetPickerButton({
  kind,
  label,
  onPick
}: {
  kind: PickKind
  label?: string
  onPick: (picked: PickedAsset) => void
}): JSX.Element {
  const pick = async (): Promise<void> => {
    if (typeof window.renpyStudio === 'undefined') return
    const picked = await window.renpyStudio.pickAsset(kind)
    if (picked) onPick(picked)
  }

  return (
    <button type="button" className="btn btn-sm" onClick={pick}>
      {label ?? '选择文件…'}
    </button>
  )
}
