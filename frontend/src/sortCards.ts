import type { Card, Priority } from './types.ts'

export type SortKey = 'priority' | 'dueDate'

// forward は「高→中→低」「早い→遅い」。reverse はその逆
type Direction = 'forward' | 'reverse'

// 並べ替えボタン。左からこの順番で並べる（docs/画面設計.md 5章）
export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'priority', label: '優先度順' },
  { key: 'dueDate', label: '期限順' },
]

const PRIORITY_RANKS: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

// forward のときに、小さいほど上に並ぶ。未設定なら null
function rank(card: Card, sortKey: SortKey): number | string | null {
  if (sortKey === 'priority') {
    return card.priority === null ? null : PRIORITY_RANKS[card.priority]
  }
  // 期限は「2026-10-15」の形なので、文字のまま比べられる
  return card.dueDate
}

// 並べ替えたカードを返す。順位が同じカードは、もとの上下の順番のままにする
function sortCards(cards: Card[], sortKey: SortKey, direction: Direction): Card[] {
  return [...cards].sort((a, b) => {
    const rankA = rank(a, sortKey)
    const rankB = rank(b, sortKey)
    // 未設定のカードは、どちらの順番でも一番下に集める（docs/機能要件.md 4.9）
    if (rankA === null || rankB === null) {
      if (rankA === rankB) {
        return 0
      }
      return rankA === null ? 1 : -1
    }
    if (rankA === rankB) {
      return 0
    }
    const order = rankA < rankB ? -1 : 1
    return direction === 'forward' ? order : -order
  })
}

function sameOrder(a: Card[], b: Card[]): boolean {
  return a.every((card, index) => card.id === b[index].id)
}

// 並べ替えボタンを押したあとの並び順を返す。
// 今 forward の順番に並んでいるときは、逆の順番にする。それ以外のときは、forward の順番にする。
// こうすると、押すたびに順番が入れ替わる
export function toggleSort(cards: Card[], sortKey: SortKey): Card[] {
  const forward = sortCards(cards, sortKey, 'forward')
  return sameOrder(cards, forward) ? sortCards(cards, sortKey, 'reverse') : forward
}
