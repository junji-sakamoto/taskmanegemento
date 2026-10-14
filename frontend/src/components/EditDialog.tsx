import { useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, SyntheticEvent } from 'react'
import { COLUMNS } from '../constants.ts'
import type { Card, ColumnKey } from '../types.ts'
import { useCardForm } from '../useCardForm.ts'
import CardFields from './CardFields.tsx'
import DeleteDialog from './DeleteDialog.tsx'

type Props = {
  card: Card
  // カードが今入っているカラム
  columnKey: ColumnKey
  onSave: (card: Card, columnKey: ColumnKey) => void
  onDelete: (cardId: string) => void
  onClose: () => void
}

// S-3 編集ダイアログ（docs/画面設計.md 7章）
export default function EditDialog({ card, columnKey, onSave, onDelete, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const form = useCardForm(card)
  const [status, setStatus] = useState<ColumnKey>(columnKey)
  // 削除確認ダイアログ（S-4）を開いているか
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // showModal で開くと、後ろの画面を操作できなくなり、最初の入力欄が選ばれる。
  // close で閉じると、開く前に選んでいた場所に戻る（docs/画面設計.md 4章）
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = form.validate()
    if (input === null) {
      return
    }
    onSave({ id: card.id, ...input }, status)
  }

  // Esc キーは、キャンセルと同じ扱いにする
  function handleCancel(event: SyntheticEvent) {
    event.preventDefault()
    onClose()
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="edit-dialog-title"
        onCancel={handleCancel}
      >
        <form noValidate onSubmit={handleSubmit}>
          <h2 id="edit-dialog-title">カードを編集</h2>
          <CardFields form={form} idPrefix="edit" />
          <div className="field">
            <label htmlFor="edit-status">ステータス</label>
            <select
              id="edit-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ColumnKey)}
            >
              {COLUMNS.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.name}
                </option>
              ))}
            </select>
          </div>
          <div className="dialog-buttons">
            {/* 誤って押さないよう、左端に離して置く */}
            <button
              type="button"
              className="button button-danger-outline"
              onClick={() => setConfirmingDelete(true)}
            >
              削除
            </button>
            <span className="spacer"></span>
            <button type="button" className="button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="button button-primary">
              保存
            </button>
          </div>
        </form>
      </dialog>
      {/* 編集ダイアログの外に置く。中に置くと、確認ダイアログの Esc が編集ダイアログにも伝わって閉じてしまう */}
      {confirmingDelete && (
        <DeleteDialog
          title={card.title}
          onDelete={() => onDelete(card.id)}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  )
}
