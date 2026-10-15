import { useRef, useState } from 'react'
import type { CardContent, Priority } from './types.ts'

// フォームで入力する、カードの4項目
export type CardInput = Omit<CardContent, 'id'>

type Errors = {
  title?: string
  memo?: string
  dueDate?: string
}

export type CardForm = ReturnType<typeof useCardForm>

// カードの入力欄の値とチェック。S-2 と S-3 で共通（docs/画面設計.md 10章）
export function useCardForm(initial: CardInput) {
  const [title, setTitle] = useState(initial.title)
  const [memo, setMemo] = useState(initial.memo)
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '')
  const [priority, setPriority] = useState<Priority | ''>(initial.priority ?? '')
  const [errors, setErrors] = useState<Errors>({})

  const titleRef = useRef<HTMLInputElement>(null)
  const memoRef = useRef<HTMLTextAreaElement>(null)
  const dueDateRef = useRef<HTMLInputElement>(null)

  // 入力をチェックする。問題がなければ入力された値を返し、問題があれば null を返す
  function validate(): CardInput | null {
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
      return null
    }
    if (newErrors.memo) {
      memoRef.current?.focus()
      return null
    }
    if (newErrors.dueDate) {
      dueDateRef.current?.focus()
      return null
    }

    return {
      title: trimmedTitle,
      memo,
      dueDate: dueDate === '' ? null : dueDate,
      priority: priority === '' ? null : priority,
    }
  }

  return {
    title,
    setTitle,
    memo,
    setMemo,
    dueDate,
    setDueDate,
    priority,
    setPriority,
    errors,
    titleRef,
    memoRef,
    dueDateRef,
    validate,
  }
}
