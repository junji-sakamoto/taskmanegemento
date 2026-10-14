import type { KeyboardEvent } from 'react'
import { PRIORITY_LABELS } from '../constants.ts'
import { formatDueDate, todayString } from '../dateUtils.ts'
import type { Card, ColumnKey } from '../types.ts'

type Props = {
  card: Card
  columnKey: ColumnKey
  // クリックか Enter キーで、編集ダイアログを開く
  onOpen: () => void
}

// カード（docs/画面設計.md 5章）。メモはカードには出さない
export default function CardItem({ card, columnKey, onOpen }: Props) {
  // 期限が今日より前で、「完了」以外にあるときは期限切れ
  const overdue = card.dueDate !== null && card.dueDate < todayString() && columnKey !== 'done'

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      // 止めないと、同じ Enter が開いたダイアログの入力欄に届き、すぐ「保存」されて閉じてしまう
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <div className="card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={handleKeyDown}>
      <div className="card-title">{card.title}</div>
      {(card.dueDate || card.priority) && (
        <div className="card-meta">
          {card.dueDate && (
            <span className={overdue ? 'due overdue' : 'due'}>
              {formatDueDate(card.dueDate)}
              {overdue && ' 期限切れ'}
            </span>
          )}
          {card.priority && (
            <span className={`priority priority-${card.priority}`}>
              優先度：{PRIORITY_LABELS[card.priority]}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
