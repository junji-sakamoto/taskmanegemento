import { PRIORITY_LABELS } from '../constants.ts'
import { formatDueDate, todayString } from '../dateUtils.ts'
import type { Card, ColumnKey } from '../types.ts'

type Props = {
  card: Card
  columnKey: ColumnKey
}

// カード（docs/画面設計.md 5章）。メモはカードには出さない
export default function CardItem({ card, columnKey }: Props) {
  // 期限が今日より前で、「完了」以外にあるときは期限切れ
  const overdue = card.dueDate !== null && card.dueDate < todayString() && columnKey !== 'done'

  return (
    <div className="card">
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
