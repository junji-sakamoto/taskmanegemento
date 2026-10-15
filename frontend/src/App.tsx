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
import { useState } from 'react'
import {
  columnName,
  findColumnKey,
  findOverColumnKey,
  withMovedCard,
} from './boardOperations.ts'
import { CardBody } from './components/CardItem.tsx'
import Column from './components/Column.tsx'
import EditDialog from './components/EditDialog.tsx'
import Notice from './components/Notice.tsx'
import { COLUMNS } from './constants.ts'
import type { BoardRepository } from './repository/boardRepository.ts'
import { serverBoardRepository } from './repository/serverBoardRepository.ts'
import type { CardContent, ColumnKey } from './types.ts'
import { useBoard } from './useBoard.ts'
import type { CardPlace } from './useBoard.ts'

// 保存先を変えるときは、ここの保存係を差し替える
const repository: BoardRepository = serverBoardRepository

// ドラッグを始めたときの、カードの元の位置。Esc や保存の失敗のときに、ここへ戻す
type DragStart = { cardId: string; from: CardPlace }

// キーボードでは Space でつかんで離し、Esc で元に戻す（docs/機能要件.md 4.6）。
// Enter は編集ダイアログを開くのに使うので、つかむキーには入れない
const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space'] }

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Space でつかみ、矢印キーで動かし、もう一度 Space で離します。Esc で元の位置へ戻します。Enter で編集ダイアログを開きます。',
}

// S-1 ボード画面（docs/画面設計.md 5章）。
// データの読み込みと保存は useBoard に任せ、ここでは画面の状態と表示を受け持つ
export default function App() {
  const {
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
  } = useBoard(repository)
  // カード追加フォームを開いているカラム。開けるフォームは同時に1つだけ
  const [openFormColumn, setOpenFormColumn] = useState<ColumnKey | null>(null)
  // 編集ダイアログで開いているカード
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
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

  function handleAddCard(columnKey: ColumnKey, card: CardContent) {
    setOpenFormColumn(null)
    addCard(columnKey, card)
  }

  function handleSaveCard(card: CardContent, toColumn: ColumnKey) {
    setEditingCardId(null)
    saveCard(card, toColumn)
  }

  function handleDeleteCard(cardId: string) {
    setEditingCardId(null)
    deleteCard(cardId)
  }

  // ドラッグ＆ドロップ（docs/機能要件.md 4.5、docs/基本設計書.md 2.4）
  function handleDragStart(event: DragStartEvent) {
    if (board === null) {
      return
    }
    const cardId = String(event.active.id)
    const column = findColumnKey(board, cardId)
    if (column === undefined) {
      return
    }
    setDragStart({ cardId, from: { column, index: board.columns[column].indexOf(cardId) } })
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
  function handleDragEnd({ active, over }: DragEndEvent) {
    const start = dragStart
    setDragStart(null)
    if (start === null || board === null) {
      return
    }
    const cardId = String(active.id)
    const toColumn = findColumnKey(board, cardId)
    // カラムの外で離したときは、何もしなかったことにする
    if (over === null || toColumn === undefined) {
      showCardAt(cardId, start.from)
      return
    }
    let toIndex = board.columns[toColumn].indexOf(cardId)
    const overIndex = board.columns[toColumn].indexOf(String(over.id))
    if (overIndex >= 0) {
      toIndex = overIndex
    }
    moveCard(cardId, start.from, { column: toColumn, index: toIndex })
  }

  // Esc で、つかむ前の位置へ戻す
  function handleDragCancel() {
    const start = dragStart
    setDragStart(null)
    if (start !== null) {
      showCardAt(start.cardId, start.from)
    }
  }

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
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
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
                onAddCard={(card) => handleAddCard(column.key, card)}
                onOpenCard={setEditingCardId}
                onSort={(sortKey) => sortColumn(column.key, sortKey)}
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

      {editingCard !== undefined && editingColumnKey !== undefined && (
        <EditDialog
          key={editingCard.id}
          card={editingCard}
          columnKey={editingColumnKey}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onClose={() => setEditingCardId(null)}
        />
      )}
    </>
  )
}
