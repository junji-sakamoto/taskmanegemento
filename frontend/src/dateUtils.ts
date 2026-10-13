// 今日の日付を、期限と同じ形（例：2026-10-15）で返す
export function todayString(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

// 今年なら「10/15」、今年以外なら「2027/1/5」の形にする
export function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split('-').map(Number)
  if (year === new Date().getFullYear()) {
    return `${month}/${day}`
  }
  return `${year}/${month}/${day}`
}
