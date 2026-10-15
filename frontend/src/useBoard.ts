import { useCallback, useEffect, useState } from 'react'
import {
  findColumnKey,
  sameFields,
  withCard,
  withCardAt,
  withColumnOrder,
  withMovedCard,
  withoutCard,
  withUpdatedCard,
} from './boardOperations.ts'
import type { BoardRepository } from './repository/boardRepository.ts'
import { toggleSort } from './sortCards.ts'
import type { SortKey } from './sortCards.ts'
import type { Board, Card, ColumnKey } from './types.ts'

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; board: Board }
  | { status: 'error' }

// カードの位置。カラムと、上から何番目か（0から）
export type CardPlace = { column: ColumnKey; index: number }

// ボードのデータの読み込みと保存（docs/基本設計書.md 2章）。
// 画面のデータを先に書き換えて表示し、そのあとで保存係に保存を頼む。
// 保存に失敗したときは、画面のデータを操作の前に戻し、saveFailed を立てる
export function useBoard(repository: BoardRepository) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [saveFailed, setSaveFailed] = useState(false)
  // ボードを読み込む。isActive() が false になっていたら、返事は捨てる
  const load = useCallback(
    (isActive: () => boolean) => {
      repository.loadBoard().then(
        (board) => {
          if (isActive()) {
            setState({ status: 'loaded', board })
          }
        },
        () => {
          if (isActive()) {
            setState({ status: 'error' })
          }
        },
      )
    },
    [repository],
  )

  useEffect(() => {
    // 読み込みの途中で画面が作り直されたら、古い返事は捨てる
    let ignore = false
    load(() => !ignore)
    return () => {
      ignore = true
    }
  }, [load])

  // 「再読み込み」ボタン。押したときに読み込むので、effect ではなくここで呼ぶ
  function reload() {
    setState({ status: 'loading' })
    load(() => true)
  }

  function updateBoard(update: (board: Board) => Board) {
    setState((current) =>
      current.status === 'loaded' ? { status: 'loaded', board: update(current.board) } : current,
    )
  }

  // 保存を頼み、失敗したら rollback で画面のデータを戻す
  function save(request: Promise<void>, rollback: (board: Board) => Board) {
    setSaveFailed(false)
    request.catch(() => {
      updateBoard(rollback)
      setSaveFailed(true)
    })
  }

  const board = state.status === 'loaded' ? state.board : null

  // 未着手カラムの一番下に、カードを加える
  function addCard(columnKey: ColumnKey, card: Card) {
    updateBoard((current) => withCard(current, columnKey, card))
    save(repository.addCard(columnKey, card), (current) => withoutCard(current, columnKey, card.id))
  }

  // 編集ダイアログの「保存」。中身の更新と、ステータスを変えたときの移動を、1回の保存で行う
  function saveCard(card: Card, toColumn: ColumnKey) {
    if (board === null) {
      return
    }
    const previous = board.cards[card.id]
    const fromColumn = findColumnKey(board, card.id)
    if (previous === undefined || fromColumn === undefined) {
      return
    }
    const moved = fromColumn !== toColumn
    if (!moved && sameFields(previous, card)) {
      return
    }

    // ステータスを変えたカードは、移動先のカラムの一番下に入れる
    const fromIndex = board.columns[fromColumn].indexOf(card.id)
    const toIndex = board.columns[toColumn].length

    updateBoard((current) => {
      const updated = withUpdatedCard(current, card)
      return moved ? withMovedCard(updated, card.id, fromColumn, toColumn, toIndex) : updated
    })
    save(repository.updateCard(card, toColumn), (current) => {
      const restored = withUpdatedCard(current, previous)
      return moved ? withMovedCard(restored, card.id, toColumn, fromColumn, fromIndex) : restored
    })
  }

  // 削除確認ダイアログの「削除する」
  function deleteCard(cardId: string) {
    if (board === null) {
      return
    }
    const card = board.cards[cardId]
    const columnKey = findColumnKey(board, cardId)
    if (card === undefined || columnKey === undefined) {
      return
    }
    const index = board.columns[columnKey].indexOf(cardId)

    updateBoard((current) => withoutCard(current, columnKey, cardId))
    // 消せなかったときは、カードを元の位置に戻す
    save(repository.deleteCard(cardId), (current) =>
      withMovedCard(withCard(current, columnKey, card), cardId, columnKey, columnKey, index),
    )
  }

  // 並べ替えボタン。順番を決めるのは画面の仕事で、サーバーには決めた順番を送る（docs/基本設計書.md 2.4）
  function sortColumn(columnKey: ColumnKey, sortKey: SortKey) {
    if (board === null) {
      return
    }
    const previousIds = board.columns[columnKey]
    const cards = previousIds.map((id) => board.cards[id])
    const sortedIds = toggleSort(cards, sortKey).map((card) => card.id)
    // 順位がみな同じで、並び順が変わらないときは、何もしない
    if (sortedIds.every((id, index) => id === previousIds[index])) {
      return
    }

    updateBoard((current) => withColumnOrder(current, columnKey, sortedIds))
    save(repository.reorderColumn(columnKey, sortedIds), (current) =>
      withColumnOrder(current, columnKey, previousIds),
    )
  }

  // ドラッグ中の見た目のために、カードを置く場所だけを変える。保存はしない
  function showCardAt(cardId: string, place: CardPlace) {
    updateBoard((current) => withCardAt(current, cardId, place.column, place.index))
  }

  // ドラッグで離したカードを、to へ置いて保存する。失敗したら from へ戻す
  function moveCard(cardId: string, from: CardPlace, to: CardPlace) {
    showCardAt(cardId, to)
    if (from.column === to.column && from.index === to.index) {
      return
    }
    save(repository.moveCard(cardId, to.column, to.index), (current) =>
      withCardAt(current, cardId, from.column, from.index),
    )
  }

  return {
    state,
    board,
    saveFailed,
    reload,
    updateBoard,
    addCard,
    saveCard,
    deleteCard,
    sortColumn,
    showCardAt,
    moveCard,
  }
}
