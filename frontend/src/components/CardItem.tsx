import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KeyboardEvent } from 'react'
import { PRIORITY_LABELS } from '../constants.ts'
import { formatDueDate, todayString } from '../dateUtils.ts'
import type { Card, ColumnKey } from '../types.ts'

type BodyProps = {
  card: Card
  columnKey: ColumnKey
}

// カードの中身。ボードの上のカードと、ドラッグ中にマウスについてくるカードで同じものを使う
export function CardBody({ card, columnKey }: BodyProps) {
  // 期限が今日より前で、「完了」以外にあるときは期限切れ
  const overdue = card.dueDate !== null && card.dueDate < todayString() && columnKey !== 'done'

  return (
    <>
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
    </>
  )
}

type Props = BodyProps & {
  // クリックか Enter キーで、編集ダイアログを開く
  onOpen: () => void
}

// カード（docs/画面設計.md 5章）。メモはカードには出さない。
// マウスでドラッグするか、Space でつかんで矢印キーで動かす（docs/機能要件.md 4.5、4.6）
export default function CardItem({ card, columnKey, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    attributes: { roleDescription: '動かせるカード' },
  })

  function handleKeyDown(event: KeyboardEvent) {
    // Space でつかむ処理は、dnd-kit に任せる
    listeners?.onKeyDown?.(event)
    if (event.key === 'Enter' && !isDragging) {
      // 止めないと、同じ Enter が開いたダイアログの入力欄に届き、すぐ「保存」されて閉じてしまう
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'card dragging' : 'card'}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <CardBody card={card} columnKey={columnKey} />
    </div>
  )
}
