// データの形（docs/データ設計.md 1章、2.2）。サーバーの GET /api/board が返す形と同じ

export type ColumnKey = 'todo' | 'doing' | 'done'

export type Priority = 'high' | 'medium' | 'low'

// カードの中身。画面で入力して、サーバーへ送る項目
export type CardContent = {
  id: string
  title: string
  memo: string
  // 期限（例：2026-10-15）と優先度は、未設定なら null
  dueDate: string | null
  priority: Priority | null
}

export type Card = CardContent & {
  // 作成日時と更新日時（例：2026-10-15T03:15:16.123Z）。サーバーが記録する。
  // 見せるためだけに持ち、サーバーへは送らない。バックアップのファイルにも入れない
  createdAt: string
  updatedAt: string
}

export type Board = {
  version: number
  // カラムごとの、カードの id の並び順
  columns: Record<ColumnKey, string[]>
  cards: Record<string, Card>
}
