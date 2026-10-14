import type { Board, Card, ColumnKey } from '../types.ts'

// 保存係（docs/基本設計書.md 1.3）。画面は、保存先を知らずにこの形で頼む。
// ほかの仕事（削除、並べ替え、置き換え）は、機能を作るときに足す
export type BoardRepository = {
  loadBoard(): Promise<Board>
  // 指定したカラムの一番下に、カードを1枚加える
  addCard(columnKey: ColumnKey, card: Card): Promise<void>
  // カードの4項目を書き換える
  updateCard(card: Card): Promise<void>
  // カードを、指定したカラムの指定した位置（上から何番目か。0から）へ移す
  moveCard(cardId: string, columnKey: ColumnKey, position: number): Promise<void>
}
