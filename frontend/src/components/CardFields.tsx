import { PRIORITY_LABELS } from '../constants.ts'
import type { Priority } from '../types.ts'
import type { CardForm } from '../useCardForm.ts'

type Props = {
  form: CardForm
  // 入力欄の id が、ほかのフォームと重ならないようにするための頭の文字
  idPrefix: string
}

// カードの入力欄。S-2 と S-3 で共通（docs/画面設計.md 6章、7章）
export default function CardFields({ form, idPrefix }: Props) {
  const { errors, titleRef, memoRef, dueDateRef } = form

  return (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-title`}>タイトル</label>
        <input
          type="text"
          id={`${idPrefix}-title`}
          ref={titleRef}
          className={errors.title ? 'invalid' : undefined}
          autoComplete="off"
          value={form.title}
          onChange={(event) => form.setTitle(event.target.value)}
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
          value={form.memo}
          onChange={(event) => form.setMemo(event.target.value)}
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
          value={form.dueDate}
          onChange={(event) => form.setDueDate(event.target.value)}
        />
        {errors.dueDate && <p className="error">{errors.dueDate}</p>}
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-priority`}>優先度</label>
        <select
          id={`${idPrefix}-priority`}
          value={form.priority}
          onChange={(event) => form.setPriority(event.target.value as Priority | '')}
        >
          <option value="">なし</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
