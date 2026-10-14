import { useLayoutEffect, useRef } from 'react'
import type { SyntheticEvent } from 'react'

type Props = {
  title: string
  onDelete: () => void
  onCancel: () => void
}

// S-4 削除確認ダイアログ（docs/画面設計.md 8章）
export default function DeleteDialog({ title, onDelete, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // 編集ダイアログの上に重ねて開く。うっかり Enter を押しても消えないように、
  // 最初は「キャンセル」を選んだ状態にする
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    cancelRef.current?.focus()
    return () => dialog?.close()
  }, [])

  // Esc キーは、キャンセルと同じ扱いにする
  function handleCancel(event: SyntheticEvent) {
    event.preventDefault()
    onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog-small"
      aria-labelledby="delete-dialog-text"
      onCancel={handleCancel}
    >
      <p id="delete-dialog-text">『{title}』を削除しますか？ 元に戻せません。</p>
      <div className="dialog-buttons">
        <span className="spacer"></span>
        <button type="button" className="button" ref={cancelRef} onClick={onCancel}>
          キャンセル
        </button>
        <button type="button" className="button button-danger" onClick={onDelete}>
          削除する
        </button>
      </div>
    </dialog>
  )
}
