import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { PRIORITY_LABELS } from '../constants.ts'
import type { Card, ColumnKey, Priority } from '../types.ts'

type Props = {
  columnKey: ColumnKey
  onAdd: (card: Card) => void
  onCancel: () => void
}

type Errors = {
  title?: string
  memo?: string
  dueDate?: string
}

// S-2 カード追加フォーム（docs/画面設計.md 6章）
export default function AddCardForm({ columnKey, onAdd, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [errors, setErrors] = useState<Errors>({})

  const titleRef = useRef<HTMLInputElement>(null)
  const memoRef = useRef<HTMLTextAreaElement>(null)
  const dueDateRef = useRef<HTMLInputElement>(null)

  // 開いたときに、タイトルを選んだ状態にする
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // 入力のチェック（docs/画面設計.md 10章）
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    const newErrors: Errors = {}

    if (trimmedTitle.length === 0) {
      newErrors.title = 'タイトルを入力してください'
    } else if (trimmedTitle.length > 100) {
      newErrors.title = 'タイトルは100文字以内で入力してください'
    }
    if (memo.length > 1000) {
      newErrors.memo = 'メモは1000文字以内で入力してください'
    }
    // 途中までしか入れていない日付は、値が空になるので、入力欄に直接たずねる
    if (dueDateRef.current?.validity.badInput) {
      newErrors.dueDate = '正しい日付を入力してください'
    }
    setErrors(newErrors)

    // 問題のある最初の入力欄を選んだ状態にする
    if (newErrors.title) {
      titleRef.current?.focus()
      return
    }
    if (newErrors.memo) {
      memoRef.current?.focus()
      return
    }
    if (newErrors.dueDate) {
      dueDateRef.current?.focus()
      return
    }

    onAdd({
      // id は画面の側で作る（docs/データ設計.md 2.2）
      id: crypto.randomUUID(),
      title: trimmedTitle,
      memo,
      dueDate: dueDate === '' ? null : dueDate,
      priority: priority === '' ? null : priority,
    })
  }

  // Esc キーは、キャンセルと同じ扱いにする
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onCancel()
    }
  }

  const idPrefix = `add-${columnKey}`

  return (
    <form className="add-form" noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className="field">
        <label htmlFor={`${idPrefix}-title`}>タイトル</label>
        <input
          type="text"
          id={`${idPrefix}-title`}
          ref={titleRef}
          className={errors.title ? 'invalid' : undefined}
          autoComplete="off"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {errors.title && <p className="error">{errors.title}</p>}
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-memo`}>メモ</label>
        <textarea
          id={`${idPrefix}-memo`}
          ref={memoRef}
          className={errors.memo ? 'invalid' : undefined}
          rows={3}
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
        {errors.memo && <p className="error">{errors.memo}</p>}
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-dueDate`}>期限</label>
        <input
          type="date"
          id={`${idPrefix}-dueDate`}
          ref={dueDateRef}
          className={errors.dueDate ? 'invalid' : undefined}
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        {errors.dueDate && <p className="error">{errors.dueDate}</p>}
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-priority`}>優先度</label>
        <select
          id={`${idPrefix}-priority`}
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority | '')}
        >
          <option value="">なし</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-buttons">
        <button type="button" className="button" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="button button-primary">
          追加
        </button>
      </div>
    </form>
  )
}
