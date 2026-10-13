import type { Board } from '../types.ts'
import type { BoardRepository } from './boardRepository.ts'

// サーバーに頼む保存係（docs/基本設計書.md 3章）
export const serverBoardRepository: BoardRepository = {
  async loadBoard(): Promise<Board> {
    const response = await fetch('/api/board')
    if (!response.ok) {
      throw new Error(`ボードを読み込めませんでした（${response.status}）`)
    }
    return response.json()
  },
}
