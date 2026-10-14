import { useEffect, useState } from 'react'
import Column from './components/Column.tsx'
import Notice from './components/Notice.tsx'
import { COLUMNS } from './constants.ts'
import type { BoardRepository } from './repository/boardRepository.ts'
import { serverBoardRepository } from './repository/serverBoardRepository.ts'
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

// S-1 ボード画面（docs/画面設計.md 5章）
export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // 「再読み込み」を押した回数。増やすと、もう一度読み込む
  const [reloadCount, setReloadCount] = useState(0)
  // カード追加フォームを開いているカラム。開けるフォームは同時に1つだけ
  const [openFormColumn, setOpenFormColumn] = useState<ColumnKey | null>(null)
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
        {state.status === 'loaded' &&
          COLUMNS.map((column) => (
            <Column
              key={column.key}
              columnKey={column.key}
              name={column.name}
              cards={state.board.columns[column.key].map((id) => state.board.cards[id])}
              formOpen={openFormColumn === column.key}
              onOpenForm={() => setOpenFormColumn(column.key)}
              onCloseForm={() => setOpenFormColumn(null)}
              onAddCard={(card) => addCard(column.key, card)}
            />
          ))}
      </main>
    </>
  )
}
