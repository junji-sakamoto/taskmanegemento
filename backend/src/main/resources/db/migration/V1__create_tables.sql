-- ボード、カラム、カードの3つのテーブルを作る（docs/データ設計.md 3.3）

CREATE TABLE boards (
    id         UUID         PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE columns (
    id       UUID        PRIMARY KEY,
    board_id UUID        NOT NULL REFERENCES boards (id),
    key      VARCHAR(10) NOT NULL CHECK (key IN ('todo', 'doing', 'done')),
    name     VARCHAR(20) NOT NULL,
    position INTEGER     NOT NULL CHECK (position >= 0),
    UNIQUE (board_id, key)
);

CREATE TABLE cards (
    id         UUID          PRIMARY KEY,
    column_id  UUID          NOT NULL REFERENCES columns (id),
    title      VARCHAR(100)  NOT NULL CHECK (title <> ''),
    memo       VARCHAR(1000) NOT NULL DEFAULT '',
    due_date   DATE,
    priority   VARCHAR(10)   CHECK (priority IN ('high', 'medium', 'low')),
    position   INTEGER       NOT NULL CHECK (position >= 0),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX cards_column_id_idx ON cards (column_id);

-- ボード1つとカラム3つは、最初から入れておく
INSERT INTO boards (id, name)
VALUES (gen_random_uuid(), 'タスク管理ボード');

INSERT INTO columns (id, board_id, key, name, position)
SELECT gen_random_uuid(), b.id, c.key, c.name, c.position
FROM boards b
CROSS JOIN (VALUES ('todo', '未着手', 0), ('doing', '作業中', 1), ('done', '完了', 2))
    AS c (key, name, position);
