// カードの id（UUID の第 4 版。例：3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90）を作る（docs/データ設計.md 2.2）。
// crypto.randomUUID() は HTTPS か localhost でしか使えず、AWS の EC2（HTTP）では動かないので、
// HTTP でも使える crypto.getRandomValues() で作る
export function createId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  // 第 4 版（乱数で作った UUID）であることと、決まった形（バリアント）であることを書き込む
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
