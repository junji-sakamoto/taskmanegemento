type Props = {
  text: string
  // 渡したときだけ、「再読み込み」ボタンを出す
  onReload?: () => void
}

// お知らせ欄（docs/画面設計.md 5章）
export default function Notice({ text, onReload }: Props) {
  return (
    <div className="notice" role="alert">
      <span>{text}</span>
      {onReload && (
        <button type="button" className="button" onClick={onReload}>
          再読み込み
        </button>
      )}
    </div>
  )
}
