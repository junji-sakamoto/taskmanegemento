import type { ColumnKey, Priority } from './types.ts'

// カラムは、左からこの順番で並べる
export const COLUMNS: { key: ColumnKey; name: string }[] = [
  { key: 'todo', name: '未着手' },
  { key: 'doing', name: '作業中' },
  { key: 'done', name: '完了' },
]

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}
