import { useEffect } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { Card, ColumnKey } from '../types.ts'
import { useCardForm } from '../useCardForm.ts'
import CardFields from './CardFields.tsx'

type Props = {
  columnKey: ColumnKey
  onAdd: (card: Card) => void
  onCancel: () => void
}

// S-2 カード追加フォーム（docs/画面設計.md 6章）
export default function AddCardForm({ columnKey, onAdd, onCancel }: Props) {
  const form = useCardForm({ title: '', memo: '', dueDate: null, priority: null })
  const { titleRef } = form

  // 開いたときに、タイトルを選んだ状態にする
  useEffect(() => {
    titleRef.current?.focus()
  }, [titleRef])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = form.validate()
    if (input === null) {
      return
    }
    // id は画面の側で作る（docs/データ設計.md 2.2）
    onAdd({ id: crypto.randomUUID(), ...input })
  }

  // Esc キーは、キャンセルと同じ扱いにする
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <form className="add-form" noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <CardFields form={form} idPrefix={`add-${columnKey}`} />
      <div className="form-buttons">
        <button type="button" className="button" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="button button-primary">
          追加
        </button>
      </div>
    </form>
  )
}
