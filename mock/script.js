// タスク管理アプリ 画面モック
// 画面の見た目と動きを確かめるためのもの。データは保存しないので、
// ページを開き直すとサンプルのカードに戻る。

const COLUMNS = [
  { key: 'todo', name: '未着手' },
  { key: 'doing', name: '作業中' },
  { key: 'done', name: '完了' },
];

const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' };

// サンプルのデータ。形は docs/データ設計.md 2.2 と同じ
function createSampleBoard() {
  return {
    version: 1,
    columns: {
      todo: ['c-001', 'c-002', 'c-003', 'c-004'],
      doing: ['c-005', 'c-006'],
      done: ['c-007'],
    },
    cards: {
      'c-001': { id: 'c-001', title: '要件定義書を書く', memo: '機能と保存方法をまとめる', dueDate: '2026-10-15', priority: 'high' },
      'c-002': { id: 'c-002', title: '設計書を書く', memo: '', dueDate: null, priority: null },
      'c-003': { id: 'c-003', title: '技術スタックを決める', memo: '', dueDate: '2026-10-05', priority: 'medium' },
      'c-004': { id: 'c-004', title: '第2段階のデータベースについて調べ、どの製品を使うか比べて決める（長いタイトルは折り返して全部表示する）', memo: '', dueDate: '2027-01-05', priority: 'low' },
      'c-005': { id: 'c-005', title: '画面を作る', memo: '', dueDate: '2026-10-20', priority: 'medium' },
      'c-006': { id: 'c-006', title: '画面モックで認識を合わせる', memo: '', dueDate: null, priority: 'high' },
      'c-007': { id: 'c-007', title: 'リポジトリを作る', memo: '', dueDate: '2026-10-01', priority: null },
    },
  };
}

function createEmptyBoard() {
  return { version: 1, columns: { todo: [], doing: [], done: [] }, cards: {} };
}

// ---------- 画面の状態 ----------

let board = createSampleBoard();
let openFormColumn = null; // カード追加フォームを開いているカラム。開けるのは1つだけ
let loading = false;
let grabbed = null;        // キーボードでつかんでいるカード { id, fromColumn, fromIndex }
let dragId = null;         // マウスでドラッグしているカードの id
let dropTarget = null;     // ドロップする先 { column, index }
let editingId = null;      // 編集ダイアログで開いているカードの id
let pendingImport = null;  // 読み込み確認ダイアログで待っているボード

const boardEl = document.getElementById('board');
const noticeEl = document.getElementById('notice');
const noticeTextEl = document.getElementById('notice-text');
const noticeReloadEl = document.getElementById('notice-reload');
const liveEl = document.getElementById('live');
const editDialog = document.getElementById('edit-dialog');
const editForm = document.getElementById('edit-form');
const deleteDialog = document.getElementById('delete-dialog');
const importDialog = document.getElementById('import-dialog');
const importFileEl = document.getElementById('import-file');

// ---------- 小さな道具 ----------

function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// 今年なら「10/15」、今年以外なら「2027/1/5」の形にする
function formatDueDate(dueDate) {
  const [year, month, day] = dueDate.split('-').map(Number);
  if (year === new Date().getFullYear()) {
    return `${month}/${day}`;
  }
  return `${year}/${month}/${day}`;
}

function findCard(id) {
  for (const column of COLUMNS) {
    const index = board.columns[column.key].indexOf(id);
    if (index !== -1) {
      return { column: column.key, index };
    }
  }
  return null;
}

function moveCard(id, toColumn, toIndex) {
  const from = findCard(id);
  board.columns[from.column].splice(from.index, 1);
  board.columns[toColumn].splice(toIndex, 0, id);
}

function showNotice(text, withReload = false) {
  noticeTextEl.textContent = text;
  noticeReloadEl.hidden = !withReload;
  noticeEl.hidden = false;
}

function hideNotice() {
  noticeEl.hidden = true;
}

function focusCard(id) {
  const el = boardEl.querySelector(`.card[data-id="${id}"]`);
  if (el) {
    el.focus();
  }
}

// ---------- 入力欄（S-2 と S-3 で共通） ----------

function createFields(prefix) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="field">
      <label for="${prefix}-title">タイトル</label>
      <input type="text" id="${prefix}-title" name="title" autocomplete="off">
      <p class="error" data-error-for="title" hidden></p>
    </div>
    <div class="field">
      <label for="${prefix}-memo">メモ</label>
      <textarea id="${prefix}-memo" name="memo" rows="3"></textarea>
      <p class="error" data-error-for="memo" hidden></p>
    </div>
    <div class="field">
      <label for="${prefix}-dueDate">期限</label>
      <input type="date" id="${prefix}-dueDate" name="dueDate">
      <p class="error" data-error-for="dueDate" hidden></p>
    </div>
    <div class="field">
      <label for="${prefix}-priority">優先度</label>
      <select id="${prefix}-priority" name="priority">
        <option value="">なし</option>
        <option value="high">高</option>
        <option value="medium">中</option>
        <option value="low">低</option>
      </select>
    </div>
  `;
  return wrapper;
}

// 入力のチェック（docs/画面設計.md 10章）。
// 問題がなければ入力された値を返し、問題があれば null を返す
function validate(form) {
  const errors = {};
  const title = form.elements.title.value.trim();
  const memo = form.elements.memo.value;
  const dueDateEl = form.elements.dueDate;

  if (title.length === 0) {
    errors.title = 'タイトルを入力してください';
  } else if (title.length > 100) {
    errors.title = 'タイトルは100文字以内で入力してください';
  }
  if (memo.length > 1000) {
    errors.memo = 'メモは1000文字以内で入力してください';
  }
  if (dueDateEl.validity.badInput) {
    errors.dueDate = '正しい日付を入力してください';
  }

  let firstInvalid = null;
  for (const name of ['title', 'memo', 'dueDate']) {
    const input = form.elements[name];
    const errorEl = form.querySelector(`[data-error-for="${name}"]`);
    errorEl.textContent = errors[name] || '';
    errorEl.hidden = !errors[name];
    input.classList.toggle('invalid', Boolean(errors[name]));
    if (errors[name] && !firstInvalid) {
      firstInvalid = input;
    }
  }
  if (firstInvalid) {
    firstInvalid.focus();
    return null;
  }

  return {
    title,
    memo,
    dueDate: dueDateEl.value || null,
    priority: form.elements.priority.value || null,
  };
}

// ---------- S-1 ボード画面 ----------

function render() {
  boardEl.innerHTML = '';
  if (loading) {
    boardEl.innerHTML = '<p class="loading">読み込み中…</p>';
    return;
  }
  for (const column of COLUMNS) {
    boardEl.appendChild(createColumn(column));
  }
}

function createColumn(column) {
  const ids = board.columns[column.key];
  const section = document.createElement('section');
  section.className = 'column';
  section.dataset.column = column.key;

  const header = document.createElement('div');
  header.className = 'column-header';
  const heading = document.createElement('h2');
  heading.textContent = `${column.name}（${ids.length}）`;
  header.appendChild(heading);
  for (const sortKey of Object.keys(SORTS)) {
    const sortButton = document.createElement('button');
    sortButton.type = 'button';
    sortButton.className = 'sort-button';
    sortButton.dataset.sort = sortKey;
    sortButton.textContent = SORTS[sortKey].label;
    sortButton.setAttribute('aria-label', `${column.name}を${SORTS[sortKey].label}に並べ替える`);
    sortButton.disabled = ids.length < 2;
    sortButton.addEventListener('click', () => sortColumn(column, sortKey));
    header.appendChild(sortButton);
  }
  section.appendChild(header);

  const list = document.createElement('div');
  list.className = 'card-list';
  if (ids.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'カードはありません';
    list.appendChild(empty);
  }
  for (const id of ids) {
    list.appendChild(createCard(board.cards[id], column.key));
  }
  section.appendChild(list);

  if (openFormColumn === column.key) {
    section.appendChild(createAddForm(column.key));
  } else {
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'add-button';
    addButton.textContent = '＋ カードを追加';
    addButton.addEventListener('click', () => openAddForm(column.key));
    section.appendChild(addButton);
  }

  section.addEventListener('dragover', (event) => onDragOver(event, column.key, list));
  section.addEventListener('drop', onDrop);
  return section;
}

function createCard(card, columnKey) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.id = card.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.draggable = true;

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = card.title;
  el.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  if (card.dueDate) {
    const due = document.createElement('span');
    due.className = 'due';
    due.textContent = formatDueDate(card.dueDate);
    // 期限が今日より前で、「完了」以外にあるときは期限切れ
    if (card.dueDate < todayString() && columnKey !== 'done') {
      due.classList.add('overdue');
      due.textContent += ' 期限切れ';
    }
    meta.appendChild(due);
  }
  if (card.priority) {
    const priority = document.createElement('span');
    priority.className = `priority priority-${card.priority}`;
    priority.textContent = `優先度：${PRIORITY_LABELS[card.priority]}`;
    meta.appendChild(priority);
  }
  el.appendChild(meta);

  if (grabbed && grabbed.id === card.id) {
    el.classList.add('grabbed');
    const hint = document.createElement('div');
    hint.className = 'grab-hint';
    hint.textContent = '移動中：矢印キーで動かす ／ Space で確定 ／ Esc で元に戻す';
    el.appendChild(hint);
  }

  el.addEventListener('click', () => openEditDialog(card.id));
  el.addEventListener('keydown', (event) => onCardKeyDown(event, card.id));
  el.addEventListener('dragstart', (event) => {
    dragId = card.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.id);
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => {
    dragId = null;
    dropTarget = null;
    render();
  });
  return el;
}

// ---------- 並べ替えボタン ----------

// ボタンを押したときに1回だけ並べ替える。そのあとは、また手で自由に動かせる。
// 未設定のカードは下に集める。同じ順位のカードは、今の並び順のままにする
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const SORTS = {
  priority: {
    label: '優先度順',
    rank: (card) => (card.priority ? PRIORITY_RANK[card.priority] : 3),
  },
  dueDate: {
    label: '期限順',
    rank: (card) => card.dueDate || '9999-12-31',
  },
};

function sortColumn(column, sortKey) {
  const rank = SORTS[sortKey].rank;
  board.columns[column.key].sort((a, b) => {
    const rankA = rank(board.cards[a]);
    const rankB = rank(board.cards[b]);
    if (rankA < rankB) {
      return -1;
    }
    return rankA > rankB ? 1 : 0;
  });
  hideNotice();
  liveEl.textContent = `${column.name}を${SORTS[sortKey].label}に並べ替えました。`;
  render();
  boardEl.querySelector(`.column[data-column="${column.key}"] [data-sort="${sortKey}"]`).focus();
}

// ---------- S-2 カード追加フォーム ----------

function openAddForm(columnKey) {
  openFormColumn = columnKey;
  render();
  boardEl.querySelector('.add-form input[name="title"]').focus();
}

function closeAddForm() {
  const columnKey = openFormColumn;
  openFormColumn = null;
  render();
  boardEl.querySelector(`.column[data-column="${columnKey}"] .add-button`).focus();
}

function createAddForm(columnKey) {
  const form = document.createElement('form');
  form.className = 'add-form';
  form.noValidate = true;
  form.appendChild(createFields(`add-${columnKey}`));

  const buttons = document.createElement('div');
  buttons.className = 'form-buttons';
  buttons.innerHTML = `
    <button type="button" class="button" data-action="cancel">キャンセル</button>
    <button type="submit" class="button button-primary">追加</button>
  `;
  form.appendChild(buttons);

  // タイトルの入力欄で Enter を押したときも、ここを通る
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = validate(form);
    if (!values) {
      return;
    }
    const id = crypto.randomUUID();
    board.cards[id] = { id, ...values };
    board.columns[columnKey].push(id);
    hideNotice();
    closeAddForm();
  });
  buttons.querySelector('[data-action="cancel"]').addEventListener('click', closeAddForm);
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAddForm();
    }
  });
  return form;
}

// ---------- S-3 編集ダイアログ ----------

document.getElementById('edit-fields').appendChild(createFields('edit'));

function openEditDialog(id) {
  if (grabbed) {
    return;
  }
  editingId = id;
  const card = board.cards[id];
  editForm.elements.title.value = card.title;
  editForm.elements.memo.value = card.memo;
  editForm.elements.dueDate.value = card.dueDate || '';
  editForm.elements.priority.value = card.priority || '';
  for (const errorEl of editForm.querySelectorAll('.error')) {
    errorEl.hidden = true;
  }
  for (const input of editForm.querySelectorAll('.invalid')) {
    input.classList.remove('invalid');
  }
  editDialog.showModal();
  editForm.elements.title.focus();
}

editForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = validate(editForm);
  if (!values) {
    return;
  }
  Object.assign(board.cards[editingId], values);
  hideNotice();
  editDialog.close();
});

document.getElementById('edit-cancel').addEventListener('click', () => editDialog.close());

// 保存、キャンセル、Esc のどれで閉じても、開く前に選んでいたカードへ戻る
editDialog.addEventListener('close', () => {
  const id = editingId;
  editingId = null;
  render();
  focusCard(id);
});

// ---------- S-4 削除確認ダイアログ ----------

document.getElementById('edit-delete').addEventListener('click', () => {
  const title = board.cards[editingId].title;
  document.getElementById('delete-dialog-text').textContent =
    `『${title}』を削除しますか？ 元に戻せません。`;
  deleteDialog.showModal();
});

document.getElementById('delete-cancel').addEventListener('click', () => deleteDialog.close());

document.getElementById('delete-ok').addEventListener('click', () => {
  const place = findCard(editingId);
  board.columns[place.column].splice(place.index, 1);
  delete board.cards[editingId];
  hideNotice();
  deleteDialog.close();
  editDialog.close();
});

// ---------- ドラッグ＆ドロップ ----------

function onDragOver(event, columnKey, list) {
  if (!dragId) {
    return;
  }
  event.preventDefault();
  const cards = [...list.querySelectorAll('.card:not(.dragging)')];
  let index = cards.findIndex((cardEl) => {
    const rect = cardEl.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  });
  if (index === -1) {
    index = cards.length;
  }
  dropTarget = { column: columnKey, index };

  // カードが入る位置に線を出す
  let line = boardEl.querySelector('.drop-line');
  if (!line) {
    line = document.createElement('div');
    line.className = 'drop-line';
  }
  if (index < cards.length) {
    list.insertBefore(line, cards[index]);
  } else {
    list.appendChild(line);
  }
}

function onDrop(event) {
  if (!dragId || !dropTarget) {
    return;
  }
  event.preventDefault();
  const id = dragId;
  moveCard(id, dropTarget.column, dropTarget.index);
  dragId = null;
  dropTarget = null;
  hideNotice();
  render();
  focusCard(id);
}

// ---------- キーボードでの操作 ----------

function onCardKeyDown(event, id) {
  if (event.target !== event.currentTarget) {
    return;
  }
  const card = board.cards[id];

  if (event.key === ' ') {
    event.preventDefault();
    if (grabbed) {
      grabbed = null;
      hideNotice();
      liveEl.textContent = `「${card.title}」を離しました。`;
    } else {
      const place = findCard(id);
      grabbed = { id, fromColumn: place.column, fromIndex: place.index };
      liveEl.textContent = `「${card.title}」をつかみました。矢印キーで動かし、Space で離します。`;
    }
    render();
    focusCard(id);
    return;
  }

  if (!grabbed) {
    if (event.key === 'Enter') {
      event.preventDefault();
      openEditDialog(id);
    }
    return;
  }

  if (event.key === 'Escape') {
    moveCard(id, grabbed.fromColumn, grabbed.fromIndex);
    grabbed = null;
    liveEl.textContent = `「${card.title}」を元の位置へ戻しました。`;
    render();
    focusCard(id);
    return;
  }

  const place = findCard(id);
  const columnNumber = COLUMNS.findIndex((column) => column.key === place.column);
  let toColumn = place.column;
  let toIndex = place.index;
  if (event.key === 'ArrowUp') {
    toIndex = Math.max(0, place.index - 1);
  } else if (event.key === 'ArrowDown') {
    toIndex = Math.min(board.columns[place.column].length - 1, place.index + 1);
  } else if (event.key === 'ArrowLeft' && columnNumber > 0) {
    toColumn = COLUMNS[columnNumber - 1].key;
    toIndex = Math.min(place.index, board.columns[toColumn].length);
  } else if (event.key === 'ArrowRight' && columnNumber < COLUMNS.length - 1) {
    toColumn = COLUMNS[columnNumber + 1].key;
    toIndex = Math.min(place.index, board.columns[toColumn].length);
  } else if (!event.key.startsWith('Arrow')) {
    return;
  }
  event.preventDefault();
  moveCard(id, toColumn, toIndex);
  const columnName = COLUMNS.find((column) => column.key === toColumn).name;
  liveEl.textContent = `${columnName}の上から ${toIndex + 1} 番目`;
  render();
  focusCard(id);
}

// ---------- 書き出し ----------

document.getElementById('export-button').addEventListener('click', () => {
  const data = { ...board, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `task-board-${todayString()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

// ---------- 読み込みと S-5 読み込み確認ダイアログ ----------

function isValidBoard(data) {
  if (!data || data.version !== 1 || typeof data.cards !== 'object' || data.cards === null) {
    return false;
  }
  if (typeof data.columns !== 'object' || data.columns === null) {
    return false;
  }
  const seen = new Set();
  for (const column of COLUMNS) {
    const ids = data.columns[column.key];
    if (!Array.isArray(ids)) {
      return false;
    }
    for (const id of ids) {
      const card = data.cards[id];
      if (seen.has(id) || !card || typeof card.title !== 'string') {
        return false;
      }
      seen.add(id);
    }
  }
  return seen.size === Object.keys(data.cards).length;
}

document.getElementById('import-button').addEventListener('click', () => importFileEl.click());

importFileEl.addEventListener('change', async () => {
  const file = importFileEl.files[0];
  importFileEl.value = '';
  if (!file) {
    return;
  }
  let data = null;
  try {
    data = JSON.parse(await file.text());
  } catch {
    data = null;
  }
  if (!isValidBoard(data)) {
    showNotice('このファイルは読み込めません');
    return;
  }
  pendingImport = { version: 1, columns: data.columns, cards: data.cards };
  const count = Object.keys(data.cards).length;
  document.getElementById('import-dialog-file').textContent = `${file.name}（カード ${count} 枚）`;
  importDialog.showModal();
});

document.getElementById('import-cancel').addEventListener('click', () => importDialog.close());

document.getElementById('import-ok').addEventListener('click', () => {
  board = pendingImport;
  openFormColumn = null;
  hideNotice();
  importDialog.close();
  render();
});

importDialog.addEventListener('close', () => {
  pendingImport = null;
});

// ---------- モック用の表示切り替え（本番には付けない） ----------

function resetView() {
  loading = false;
  grabbed = null;
  openFormColumn = null;
  hideNotice();
}

const MOCK_ACTIONS = {
  normal() {
    resetView();
  },
  sample() {
    resetView();
    board = createSampleBoard();
  },
  empty() {
    resetView();
    board = createEmptyBoard();
  },
  'save-error'() {
    resetView();
    showNotice('保存できませんでした。もう一度操作してください');
  },
  offline() {
    resetView();
    showNotice('サーバーにつながりません。サーバーが起動しているか確かめてください', true);
  },
  loading() {
    resetView();
    loading = true;
  },
  'bad-file'() {
    resetView();
    showNotice('このファイルは読み込めません');
  },
};

for (const button of document.querySelectorAll('[data-mock]')) {
  button.addEventListener('click', () => {
    MOCK_ACTIONS[button.dataset.mock]();
    render();
  });
}

noticeReloadEl.addEventListener('click', () => {
  resetView();
  render();
});

render();
