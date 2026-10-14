import type { Card, Priority } from './types.ts'

export type SortKey = 'priority' | 'dueDate'

// 並べ替えボタン。左からこの順番で並べる（docs/画面設計.md 5章）
export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'priority', label: '優先度順' },
  { key: 'dueDate', label: '期限順' },
]

const PRIORITY_RANKS: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

// 小さいほど上に並ぶ。未設定のカードは、一番下に集める（docs/機能要件.md 4.9）
function rank(card: Card, sortKey: SortKey): number | string {
  if (sortKey === 'priority') {
    return card.priority === null ? 3 : PRIORITY_RANKS[card.priority]
  }
  // 期限は「2026-10-15」の形なので、文字のまま比べられる
  return card.dueDate ?? '9999-99-99'
}

// 並べ替えたカードを返す。順位が同じカードは、もとの上下の順番のままにする
export function sortCards(cards: Card[], sortKey: SortKey): Card[] {
  return [...cards].sort((a, b) => {
    const rankA = rank(a, sortKey)
    const rankB = rank(b, sortKey)
    if (rankA < rankB) {
      return -1
    }
    return rankA > rankB ? 1 : 0
  })
}
