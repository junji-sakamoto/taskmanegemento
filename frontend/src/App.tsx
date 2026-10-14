import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { Announcements, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useState } from 'react'
import { CardBody } from './components/CardItem.tsx'
import Column from './components/Column.tsx'
import EditDialog from './components/EditDialog.tsx'
import Notice from './components/Notice.tsx'
import { COLUMNS } from './constants.ts'
import type { BoardRepository } from './repository/boardRepository.ts'
import { serverBoardRepository } from './repository/serverBoardRepository.ts'
import { toggleSort } from './sortCards.ts'
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

// カードを、指定したカラムの指定した位置へ移したボードを返す。同じカラムの中の並べ替えにも使う。
// position は、カードを抜いたあとの並びで上から何番目か（0から）。サーバーの API と同じ数え方
function withMovedCard(
  board: Board,
  cardId: string,
  from: ColumnKey,
  to: ColumnKey,
  position: number,
): Board {
  const columns = { ...board.columns, [from]: board.columns[from].filter((id) => id !== cardId) }
  const destination = [...columns[to]]
  destination.splice(position, 0, cardId)
  return { ...board, columns: { ...columns, [to]: destination } }
}

// カードを、今どのカラムにあっても、指定したカラムの指定した位置へ移したボードを返す
function withCardAt(board: Board, cardId: string, to: ColumnKey, position: number): Board {
  const from = findColumnKey(board, cardId)
  return from === undefined ? board : withMovedCard(board, cardId, from, to, position)
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

// ドラッグ中に重なっている相手（カードかカラム）から、そのカラムを探す
function findOverColumnKey(board: Board, overId: string): ColumnKey | undefined {
  return COLUMNS.find((column) => column.key === overId)?.key ?? findColumnKey(board, overId)
}

function columnName(columnKey: ColumnKey): string {
  return COLUMNS.find((column) => column.key === columnKey)?.name ?? ''
}

// ドラッグを始めたときの、カードの元の位置。Esc や保存の失敗のときに、ここへ戻す
type DragStart = { cardId: string; fromColumn: ColumnKey; fromIndex: number }

// キーボードでは Space でつかんで離し、Esc で元に戻す（docs/機能要件.md 4.6）。
// Enter は編集ダイアログを開くのに使うので、つかむキーには入れない
const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space'] }

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Space でつかみ、矢印キーで動かし、もう一度 Space で離します。Esc で元の位置へ戻します。Enter で編集ダイアログを開きます。',
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
  // ドラッグしているカードと、その元の位置。ドラッグしていないときは null
  const [dragStart, setDragStart] = useState<DragStart | null>(null)

  const sensors = useSensors(
    // 少し動かしてからドラッグを始める。動かさずに離したときは、ただのクリックとして編集ダイアログを開く
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    }),
  )

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
    const sortedIds = toggleSort(cards, sortKey).map((card) => card.id)
    // 順位がみな同じで、並び順が変わらないときは、何もしない
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

  // ドラッグ＆ドロップ（docs/機能要件.md 4.5、docs/基本設計書.md 2.4）
  function handleDragStart(board: Board, event: DragStartEvent) {
    const cardId = String(event.active.id)
    const fromColumn = findColumnKey(board, cardId)
    if (fromColumn === undefined) {
      return
    }
    setDragStart({ cardId, fromColumn, fromIndex: board.columns[fromColumn].indexOf(cardId) })
  }

  // 別のカラムの上に来たら、その場でカードをそのカラムへ移して見せる。
  // 同じカラムの中の動きは、dnd-kit がカードをずらして見せてくれる
  function handleDragOver({ active, over }: DragOverEvent) {
    if (over === null) {
      return
    }
    const cardId = String(active.id)
    const overId = String(over.id)
    updateBoard((current) => {
      const fromColumn = findColumnKey(current, cardId)
      const toColumn = findOverColumnKey(current, overId)
      if (fromColumn === undefined || toColumn === undefined || fromColumn === toColumn) {
        return current
      }
      // カードの上なら、その上半分か下半分かで入れる位置を決める。カラムの上なら一番下に入れる
      const overIndex = current.columns[toColumn].indexOf(overId)
      let position = current.columns[toColumn].length
      if (overIndex >= 0) {
        const activeRect = active.rect.current.translated
        const below = activeRect !== null && activeRect.top > over.rect.top + over.rect.height / 2
        position = overIndex + (below ? 1 : 0)
      }
      return withMovedCard(current, cardId, fromColumn, toColumn, position)
    })
  }

  // 離したら、画面の位置を決めてから保存する。保存に失敗したら、元の位置へ戻す
  function handleDragEnd(board: Board, { active, over }: DragEndEvent) {
    const start = dragStart
    setDragStart(null)
    if (start === null) {
      return
    }
    const cardId = String(active.id)
    const toColumn = findColumnKey(board, cardId)
    // カラムの外で離したときは、何もしなかったことにする
    if (over === null || toColumn === undefined) {
      updateBoard((current) => withCardAt(current, cardId, start.fromColumn, start.fromIndex))
      return
    }
    let toIndex = board.columns[toColumn].indexOf(cardId)
    const overIndex = board.columns[toColumn].indexOf(String(over.id))
    if (overIndex >= 0) {
      toIndex = overIndex
    }

    updateBoard((current) => withCardAt(current, cardId, toColumn, toIndex))
    if (toColumn === start.fromColumn && toIndex === start.fromIndex) {
      return
    }
    setSaveFailed(false)
    repository.moveCard(cardId, toColumn, toIndex).catch(() => {
      updateBoard((current) => withCardAt(current, cardId, start.fromColumn, start.fromIndex))
      setSaveFailed(true)
    })
  }

  // Esc で、つかむ前の位置へ戻す
  function handleDragCancel() {
    const start = dragStart
    setDragStart(null)
    if (start !== null) {
      updateBoard((current) => withCardAt(current, start.cardId, start.fromColumn, start.fromIndex))
    }
  }

  const board = state.status === 'loaded' ? state.board : null
  const editingCard = board !== null && editingCardId !== null ? board.cards[editingCardId] : undefined
  const editingColumnKey =
    board !== null && editingCardId !== null ? findColumnKey(board, editingCardId) : undefined
  const draggingCard = board !== null && dragStart !== null ? board.cards[dragStart.cardId] : undefined
  const draggingColumnKey =
    board !== null && dragStart !== null ? findColumnKey(board, dragStart.cardId) : undefined

  // 画面を読み上げる道具に伝える文
  function cardTitle(id: string | number): string {
    return board?.cards[String(id)]?.title ?? ''
  }
  function placeText(id: string | number): string {
    if (board === null) {
      return ''
    }
    const columnKey = findOverColumnKey(board, String(id))
    if (columnKey === undefined) {
      return ''
    }
    const index = board.columns[columnKey].indexOf(String(id))
    return index >= 0
      ? `${columnName(columnKey)}の上から ${index + 1} 番目`
      : `${columnName(columnKey)}の一番下`
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `「${cardTitle(active.id)}」をつかみました。矢印キーで動かし、Space で離します。`,
    onDragOver: ({ over }) => (over === null ? undefined : placeText(over.id)),
    onDragEnd: ({ active, over }) =>
      over === null
        ? `「${cardTitle(active.id)}」を元の位置へ戻しました。`
        : `「${cardTitle(active.id)}」を${placeText(over.id)}に置きました。`,
    onDragCancel: ({ active }) => `「${cardTitle(active.id)}」を元の位置へ戻しました。`,
  }

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
        {board !== null && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            accessibility={{
              announcements,
              screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
            }}
            onDragStart={(event) => handleDragStart(board, event)}
            onDragOver={handleDragOver}
            onDragEnd={(event) => handleDragEnd(board, event)}
            onDragCancel={handleDragCancel}
          >
            {COLUMNS.map((column) => (
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
            {/* ドラッグ中に、マウスについてくるカード */}
            <DragOverlay>
              {draggingCard !== undefined && draggingColumnKey !== undefined && (
                <div className="card drag-overlay">
                  <CardBody card={draggingCard} columnKey={draggingColumnKey} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
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
