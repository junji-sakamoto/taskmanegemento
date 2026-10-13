import type { Card, ColumnKey } from '../types.ts'
import CardItem from './CardItem.tsx'

type Props = {
  columnKey: ColumnKey
  name: string
  // 並び順どおりに並んだカード
  cards: Card[]
}

// カラム（docs/画面設計.md 5章）
export default function Column({ columnKey, name, cards }: Props) {
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
          <CardItem key={card.id} card={card} columnKey={columnKey} />
        ))}
      </div>
    </section>
  )
}
