-- 動きを確かめるためのテスト用のカードを入れる。
-- サーバーの起動では実行されない（Flyway が読むフォルダの外に置いてある）。手で流す。
--
-- 流し方（日本語が文字化けしないよう、ファイルをコンテナに写してから実行する）:
--   docker cp db/testdata/insert_test_cards.sql taskmanagement-db:/tmp/insert_test_cards.sql
--   docker exec taskmanagement-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/insert_test_cards.sql'
--
-- 何度流しても同じ結果になる。このファイルが入れるカードだけを消してから入れ直すので、
-- ほかのカードには触らない。

BEGIN;

DELETE FROM cards
WHERE id IN (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000006'
);

-- カラムの id はデータベースごとに違うので、key で引く。
-- 期限なし、優先度なし、メモが空のカードも混ぜてある
INSERT INTO cards (id, column_id, title, memo, due_date, priority, position)
SELECT t.id::uuid, c.id, t.title, t.memo, t.due_date::date, t.priority, t.position
FROM (VALUES
    ('00000000-0000-4000-8000-000000000001', 'todo',  '要件定義書を書く',   '機能と保存方法をまとめる', '2026-10-15', 'high',   0),
    ('00000000-0000-4000-8000-000000000002', 'todo',  '設計書を書く',       '',                         NULL,         NULL,     1),
    ('00000000-0000-4000-8000-000000000003', 'todo',  '買い物リストを作る', '牛乳、卵、パン',           NULL,         'low',    2),
    ('00000000-0000-4000-8000-000000000004', 'doing', '画面を作る',         '',                         '2026-10-20', 'medium', 0),
    ('00000000-0000-4000-8000-000000000005', 'doing', 'API を作る',         'まずは読み取りから',       '2026-10-13', NULL,     1),
    ('00000000-0000-4000-8000-000000000006', 'done',  '技術スタックを決める', 'Spring Boot と PostgreSQL', '2026-10-01', 'high',   0)
) AS t (id, key, title, memo, due_date, priority, position)
JOIN columns c ON c.key = t.key;

COMMIT;
