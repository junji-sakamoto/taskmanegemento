import { useEffect, useRef } from 'react'
import type { Card, ColumnKey } from '../types.ts'
import AddCardForm from './AddCardForm.tsx'
import CardItem from './CardItem.tsx'

type Props = {
  columnKey: ColumnKey
  name: string
  // 並び順どおりに並んだカード
  cards: Card[]
  // このカラムで、カード追加フォームが開いているか
  formOpen: boolean
  onOpenForm: () => void
  onCloseForm: () => void
  onAddCard: (card: Card) => void
  onOpenCard: (cardId: string) => void
}

// カラム（docs/画面設計.md 5章）
export default function Column({
  columnKey,
  name,
  cards,
  formOpen,
  onOpenForm,
  onCloseForm,
  onAddCard,
  onOpenCard,
}: Props) {
  const addButtonRef = useRef<HTMLButtonElement>(null)
  // 「追加」「キャンセル」で閉じたときだけ、「カードを追加」ボタンに戻る。
  // 別のカラムのフォームを開いて閉じたときは、戻らない
  const returnFocus = useRef(false)

  useEffect(() => {
    if (!formOpen && returnFocus.current) {
      returnFocus.current = false
      addButtonRef.current?.focus()
    }
  }, [formOpen])

  function handleAdd(card: Card) {
    returnFocus.current = true
    onAddCard(card)
  }

  function handleCancel() {
    returnFocus.current = true
    onCloseForm()
  }

  return (
    <section className="column">
      <div className="column-header">
        <h2>
          {name}（{cards.length}）
        </h2>
      </div>
      <div className="card-list">
        {cards.length === 0 && <p className="empty">カードはありません</p>}
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            columnKey={columnKey}
            onOpen={() => onOpenCard(card.id)}
          />
        ))}
      </div>
      {formOpen ? (
        <AddCardForm columnKey={columnKey} onAdd={handleAdd} onCancel={handleCancel} />
      ) : (
        <button type="button" className="add-button" ref={addButtonRef} onClick={onOpenForm}>
          ＋ カードを追加
        </button>
      )}
    </section>
  )
}
