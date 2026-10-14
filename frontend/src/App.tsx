import { useEffect, useState } from 'react'
import Column from './components/Column.tsx'
import EditDialog from './components/EditDialog.tsx'
import Notice from './components/Notice.tsx'
import { COLUMNS } from './constants.ts'
import type { BoardRepository } from './repository/boardRepository.ts'
import { serverBoardRepository } from './repository/serverBoardRepository.ts'
import { sortCards } from './sortCards.ts'
import type { SortKey } from './sortCards.ts'
import type { Board, Card, ColumnKey } from './types.ts'

// 保存先を変えるときは、ここの保存係を差し替える
const repository: BoardRepository = serverBoardRepository

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; board: Board }
  | { status: 'error' }

// カラムの一番下に、カードを加えたボードを返す
function withCard(board: Board, columnKey: ColumnKey, card: Card): Board {
  return {
    ...board,
    columns: { ...board.columns, [columnKey]: [...board.columns[columnKey], card.id] },
    cards: { ...board.cards, [card.id]: card },
  }
}

// カードを取り除いたボードを返す
function withoutCard(board: Board, columnKey: ColumnKey, cardId: string): Board {
  const cards = { ...board.cards }
  delete cards[cardId]
  return {
    ...board,
    columns: { ...board.columns, [columnKey]: board.columns[columnKey].filter((id) => id !== cardId) },
    cards,
  }
}

// カードの中身を入れ替えたボードを返す。カラムと並び順は変えない
function withUpdatedCard(board: Board, card: Card): Board {
  return { ...board, cards: { ...board.cards, [card.id]: card } }
}

// カードを、別のカラムの指定した位置へ移したボードを返す
function withMovedCard(
  board: Board,
  cardId: string,
  from: ColumnKey,
  to: ColumnKey,
  position: number,
): Board {
  const destination = [...board.columns[to]]
  destination.splice(position, 0, cardId)
  return {
    ...board,
    columns: {
      ...board.columns,
      [from]: board.columns[from].filter((id) => id !== cardId),
      [to]: destination,
    },
  }
}

// カラムのカードを、渡された順番に並べ直したボードを返す。
// 渡された順番にないカード（あとから増えたカード）は、下に残す
function withColumnOrder(board: Board, columnKey: ColumnKey, cardIds: string[]): Board {
  const current = board.columns[columnKey]
  const ordered = cardIds.filter((id) => current.includes(id))
  const rest = current.filter((id) => !cardIds.includes(id))
  return { ...board, columns: { ...board.columns, [columnKey]: [...ordered, ...rest] } }
}

// カードが入っているカラムを探す
function findColumnKey(board: Board, cardId: string): ColumnKey | undefined {
  return COLUMNS.find((column) => board.columns[column.key].includes(cardId))?.key
}

function sameFields(a: Card, b: Card): boolean {
  return (
    a.title === b.title && a.memo === b.memo && a.dueDate === b.dueDate && a.priority === b.priority
  )
}

// S-1 ボード画面（docs/画面設計.md 5章）
export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // 「再読み込み」を押した回数。増やすと、もう一度読み込む
  const [reloadCount, setReloadCount] = useState(0)
  // カード追加フォームを開いているカラム。開けるフォームは同時に1つだけ
  const [openFormColumn, setOpenFormColumn] = useState<ColumnKey | null>(null)
  // 編集ダイアログで開いているカード
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    // 読み込みの途中で画面が作り直されたら、古い返事は捨てる
    let ignore = false
    repository.loadBoard().then(
      (board) => {
        if (!ignore) {
          setState({ status: 'loaded', board })
        }
      },
      () => {
        if (!ignore) {
          setState({ status: 'error' })
        }
      },
    )
    return () => {
      ignore = true
    }
  }, [reloadCount])

  function reload() {
    setState({ status: 'loading' })
    setReloadCount((count) => count + 1)
  }

  function updateBoard(update: (board: Board) => Board) {
    setState((current) =>
      current.status === 'loaded' ? { status: 'loaded', board: update(current.board) } : current,
    )
  }

  // 画面のデータを先に書き換えて表示し、そのあとで保存する（docs/基本設計書.md 2.3）
  function addCard(columnKey: ColumnKey, card: Card) {
    setOpenFormColumn(null)
    setSaveFailed(false)
    updateBoard((board) => withCard(board, columnKey, card))
    repository.addCard(columnKey, card).catch(() => {
      // 保存に失敗したときは、画面のデータを追加の前に戻す
      updateBoard((board) => withoutCard(board, columnKey, card.id))
      setSaveFailed(true)
    })
  }

  // 編集ダイアログの「保存」。中身の更新と、ステータスを変えたときの移動を行う
  async function saveCard(board: Board, card: Card, toColumn: ColumnKey) {
    setEditingCardId(null)
    const previous = board.cards[card.id]
    const fromColumn = findColumnKey(board, card.id)
    if (previous === undefined || fromColumn === undefined) {
      return
    }
    const changed = !sameFields(previous, card)
    const moved = fromColumn !== toColumn
    if (!changed && !moved) {
      return
    }

    // ステータスを変えたカードは、移動先のカラムの一番下に入れる
    const fromPosition = board.columns[fromColumn].indexOf(card.id)
    const toPosition = board.columns[toColumn].length

    setSaveFailed(false)
    updateBoard((current) => {
      const updated = withUpdatedCard(current, card)
      return moved ? withMovedCard(updated, card.id, fromColumn, toColumn, toPosition) : updated
    })

    if (changed) {
      try {
        await repository.updateCard(card)
      } catch {
        // 保存に失敗したときは、画面のデータを変える前に戻す
        updateBoard((current) => {
          const restored = withUpdatedCard(current, previous)
          return moved ? withMovedCard(restored, card.id, toColumn, fromColumn, fromPosition) : restored
        })
        setSaveFailed(true)
        return
      }
    }
    if (moved) {
      try {
        await repository.moveCard(card.id, toColumn, toPosition)
      } catch {
        // 中身の更新は済んでいるので、移動だけを元に戻す
        updateBoard((current) => withMovedCard(current, card.id, toColumn, fromColumn, fromPosition))
        setSaveFailed(true)
      }
    }
  }

  // 並べ替えボタン。順番を決めるのは画面の仕事で、サーバーには決めた順番を送る（docs/基本設計書.md 2.4）
  function sortColumn(board: Board, columnKey: ColumnKey, sortKey: SortKey) {
    const previousIds = board.columns[columnKey]
    const cards = previousIds.map((id) => board.cards[id])
    const sortedIds = sortCards(cards, sortKey).map((card) => card.id)
    // もう並んでいるときは、何もしない
    if (sortedIds.every((id, index) => id === previousIds[index])) {
      return
    }

    setSaveFailed(false)
    updateBoard((current) => withColumnOrder(current, columnKey, sortedIds))
    repository.reorderColumn(columnKey, sortedIds).catch(() => {
      // 保存に失敗したときは、並び順を押す前に戻す
      updateBoard((current) => withColumnOrder(current, columnKey, previousIds))
      setSaveFailed(true)
    })
  }

  const board = state.status === 'loaded' ? state.board : null
  const editingCard = board !== null && editingCardId !== null ? board.cards[editingCardId] : undefined
  const editingColumnKey =
    board !== null && editingCardId !== null ? findColumnKey(board, editingCardId) : undefined

  return (
    <>
      <header className="app-header">
        <h1>タスク管理</h1>
      </header>

      {state.status === 'error' && (
        <Notice
          text="サーバーにつながりません。サーバーが起動しているか確かめてください"
          onReload={reload}
        />
      )}
      {saveFailed && <Notice text="保存できませんでした。もう一度操作してください" />}

      <main className="board">
        {state.status === 'loading' && <p className="loading">読み込み中…</p>}
        {board !== null &&
          COLUMNS.map((column) => (
            <Column
              key={column.key}
              columnKey={column.key}
              name={column.name}
              cards={board.columns[column.key].map((id) => board.cards[id])}
              formOpen={openFormColumn === column.key}
              onOpenForm={() => setOpenFormColumn(column.key)}
              onCloseForm={() => setOpenFormColumn(null)}
              onAddCard={(card) => addCard(column.key, card)}
              onOpenCard={setEditingCardId}
              onSort={(sortKey) => sortColumn(board, column.key, sortKey)}
            />
          ))}
      </main>

      {board !== null && editingCard !== undefined && editingColumnKey !== undefined && (
        <EditDialog
          key={editingCard.id}
          card={editingCard}
          columnKey={editingColumnKey}
          onSave={(card, columnKey) => saveCard(board, card, columnKey)}
          onClose={() => setEditingCardId(null)}
        />
      )}
    </>
  )
}
