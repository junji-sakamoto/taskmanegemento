import type { Board, Card, ColumnKey } from '../types.ts'
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

  async addCard(columnKey: ColumnKey, card: Card): Promise<void> {
    const response = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...card, columnKey }),
    })
    if (!response.ok) {
      throw new Error(`カードを追加できませんでした（${response.status}）`)
    }
  },
}
