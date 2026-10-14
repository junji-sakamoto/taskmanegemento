import type { Board, Card, ColumnKey } from '../types.ts'

// 保存係（docs/基本設計書.md 1.3）。画面は、保存先を知らずにこの形で頼む。
// 今は「ボードを読み込む」と「カードを追加する」だけ。ほかの仕事は、機能を作るときに足す
export type BoardRepository = {
  loadBoard(): Promise<Board>
  // 指定したカラムの一番下に、カードを1枚加える
  addCard(columnKey: ColumnKey, card: Card): Promise<void>
}
