import type { Board, CardContent, ColumnKey } from '../types.ts'
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

  async addCard(columnKey: ColumnKey, card: CardContent): Promise<void> {
    const response = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...card, columnKey }),
    })
    if (!response.ok) {
      throw new Error(`カードを追加できませんでした（${response.status}）`)
    }
  },

  async updateCard(card: CardContent, columnKey: ColumnKey): Promise<void> {
    const { id, ...fields } = card
    const response = await fetch(`/api/cards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, columnKey }),
    })
    if (!response.ok) {
      throw new Error(`カードを更新できませんでした（${response.status}）`)
    }
  },

  async deleteCard(cardId: string): Promise<void> {
    const response = await fetch(`/api/cards/${cardId}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(`カードを削除できませんでした（${response.status}）`)
    }
  },

  async moveCard(cardId: string, columnKey: ColumnKey, position: number): Promise<void> {
    const response = await fetch(`/api/cards/${cardId}/position`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnKey, position }),
    })
    if (!response.ok) {
      throw new Error(`カードを移動できませんでした（${response.status}）`)
    }
  },

  async reorderColumn(columnKey: ColumnKey, cardIds: string[]): Promise<void> {
    const response = await fetch(`/api/columns/${columnKey}/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardIds }),
    })
    if (!response.ok) {
      throw new Error(`カラムを並べ替えられませんでした（${response.status}）`)
    }
  },
}
