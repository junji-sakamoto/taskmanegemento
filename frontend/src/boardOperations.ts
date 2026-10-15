import { COLUMNS } from './constants.ts'
import type { Board, Card, CardContent, ColumnKey } from './types.ts'

// ボードのデータを変える関数。どれも、もとのボードは変えずに、新しいボードを返す

// カラムの一番下に、カードを加えたボードを返す
export function withCard(board: Board, columnKey: ColumnKey, card: Card): Board {
  return {
    ...board,
    columns: { ...board.columns, [columnKey]: [...board.columns[columnKey], card.id] },
    cards: { ...board.cards, [card.id]: card },
  }
}

// カードを取り除いたボードを返す
export function withoutCard(board: Board, columnKey: ColumnKey, cardId: string): Board {
  const cards = { ...board.cards }
  delete cards[cardId]
  return {
    ...board,
    columns: { ...board.columns, [columnKey]: board.columns[columnKey].filter((id) => id !== cardId) },
    cards,
  }
}

// カードの中身を入れ替えたボードを返す。カラムと並び順は変えない
export function withUpdatedCard(board: Board, card: Card): Board {
  return { ...board, cards: { ...board.cards, [card.id]: card } }
}

// カードを、指定したカラムの指定した位置へ移したボードを返す。同じカラムの中の並べ替えにも使う。
// position は、カードを抜いたあとの並びで上から何番目か（0から）。サーバーの API と同じ数え方
export function withMovedCard(
  board: Board,
  cardId: string,
  from: ColumnKey,
  to: ColumnKey,
  position: number,
): Board {
  const columns = { ...board.columns, [from]: board.columns[from].filter((id) => id !== cardId) }
  const destination = [...columns[to]]
  destination.splice(position, 0, cardId)
  return { ...board, columns: { ...columns, [to]: destination } }
}

// カードを、今どのカラムにあっても、指定したカラムの指定した位置へ移したボードを返す
export function withCardAt(board: Board, cardId: string, to: ColumnKey, position: number): Board {
  const from = findColumnKey(board, cardId)
  return from === undefined ? board : withMovedCard(board, cardId, from, to, position)
}

// カラムのカードを、渡された順番に並べ直したボードを返す。
// 渡された順番にないカード（あとから増えたカード）は、下に残す
export function withColumnOrder(board: Board, columnKey: ColumnKey, cardIds: string[]): Board {
  const current = board.columns[columnKey]
  const ordered = cardIds.filter((id) => current.includes(id))
  const rest = current.filter((id) => !cardIds.includes(id))
  return { ...board, columns: { ...board.columns, [columnKey]: [...ordered, ...rest] } }
}

// カードが入っているカラムを探す
export function findColumnKey(board: Board, cardId: string): ColumnKey | undefined {
  return COLUMNS.find((column) => board.columns[column.key].includes(cardId))?.key
}

// ドラッグ中に重なっている相手（カードかカラム）から、そのカラムを探す
export function findOverColumnKey(board: Board, overId: string): ColumnKey | undefined {
  return COLUMNS.find((column) => column.key === overId)?.key ?? findColumnKey(board, overId)
}

export function columnName(columnKey: ColumnKey): string {
  return COLUMNS.find((column) => column.key === columnKey)?.name ?? ''
}

// カードの4項目が同じか
export function sameFields(a: CardContent, b: CardContent): boolean {
  return (
    a.title === b.title && a.memo === b.memo && a.dueDate === b.dueDate && a.priority === b.priority
  )
}
