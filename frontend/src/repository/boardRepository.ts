import type { Board } from '../types.ts'

// 保存係（docs/基本設計書.md 1.3）。画面は、保存先を知らずにこの形で頼む。
// 今は「ボードを読み込む」だけ。ほかの仕事は、機能を作るときに足す
export type BoardRepository = {
  loadBoard(): Promise<Board>
}
