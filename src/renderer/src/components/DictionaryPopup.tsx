import { useEditor } from '../store'

// ============================================================
// 辞典弹窗：点击专有名词后显示词条图片 + 文字解释
// ============================================================

export default function DictionaryPopup(): JSX.Element | null {
  const { project, activeDictTerm, setActiveDictTerm } = useEditor()
  if (!activeDictTerm) return null
  const entry = project.dictionary.find((d) => d.id === activeDictTerm)
  if (!entry) return null

  return (
    <div className="modal-overlay" onClick={() => setActiveDictTerm(null)}>
      <div className="dict-popup" onClick={(e) => e.stopPropagation()}>
        <div className="dict-head">
          <span className="dict-term">📖 {entry.term}</span>
          <button className="block-del" onClick={() => setActiveDictTerm(null)}>✕</button>
        </div>
        {entry.image && <img className="dict-img" src={entry.image} alt={entry.term} />}
        <div className="dict-body">{entry.text}</div>
      </div>
    </div>
  )
}
