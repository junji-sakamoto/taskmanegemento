import { useEffect, useState } from 'react'
import Column from './components/Column.tsx'
import Notice from './components/Notice.tsx'
import { COLUMNS } from './constants.ts'
import type { BoardRepository } from './repository/boardRepository.ts'
import { serverBoardRepository } from './repository/serverBoardRepository.ts'
import type { Board } from './types.ts'

// 保存先を変えるときは、ここの保存係を差し替える
const repository: BoardRepository = serverBoardRepository

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; board: Board }
  | { status: 'error' }

// S-1 ボード画面（docs/画面設計.md 5章）
export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // 「再読み込み」を押した回数。増やすと、もう一度読み込む
  const [reloadCount, setReloadCount] = useState(0)

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

      <main className="board">
        {state.status === 'loading' && <p className="loading">読み込み中…</p>}
        {state.status === 'loaded' &&
          COLUMNS.map((column) => (
            <Column
              key={column.key}
              columnKey={column.key}
              name={column.name}
              cards={state.board.columns[column.key].map((id) => state.board.cards[id])}
            />
          ))}
      </main>
    </>
  )
}
