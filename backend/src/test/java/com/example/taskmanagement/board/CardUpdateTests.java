package com.example.taskmanagement.board;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

// カードの更新（PATCH /api/cards/{id}）、削除（DELETE /api/cards/{id}）、移動（PUT /api/cards/{id}/position）のテスト。
// テストで入れたカードは、テストが終わるたびに取り消す
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CardUpdateTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private CardRepository cardRepository;

	@Autowired
	private BoardColumnRepository boardColumnRepository;

	@Autowired
	private EntityManager entityManager;

	// ---------- 更新 ----------

	@Test
	void 優先度と期限を変えられる() throws Exception {
		UUID id = addCard("todo", "もとのタイトル");
		int positionBefore = load(id).getPosition();

		patchCard(id, """
				{"title": "  新しいタイトル  ", "memo": "新しいメモ", "dueDate": "2026-11-01", "priority": "low"}
				""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(id.toString()))
			.andExpect(jsonPath("$.title").value("新しいタイトル"))
			.andExpect(jsonPath("$.dueDate").value("2026-11-01"))
			.andExpect(jsonPath("$.priority").value("low"));

		Card card = load(id);
		assertThat(card.getTitle()).isEqualTo("新しいタイトル");
		assertThat(card.getMemo()).isEqualTo("新しいメモ");
		assertThat(card.getDueDate()).isEqualTo(LocalDate.of(2026, 11, 1));
		assertThat(card.getPriority()).isEqualTo("low");
		// カラムと並び順は変わらない
		assertThat(card.getColumnId()).isEqualTo(columnId("todo"));
		assertThat(card.getPosition()).isEqualTo(positionBefore);
	}

	@Test
	void 期限と優先度を空にできる() throws Exception {
		UUID id = UUID.randomUUID();
		postJson("""
				{"id": "%s", "columnKey": "todo", "title": "タイトル", "dueDate": "2026-10-15", "priority": "high"}
				""".formatted(id)).andExpect(status().isCreated());

		patchCard(id, """
				{"title": "タイトル", "memo": "", "dueDate": null, "priority": null}
				""").andExpect(status().isOk());

		Card card = load(id);
		assertThat(card.getDueDate()).isNull();
		assertThat(card.getPriority()).isNull();
	}

	@Test
	void 変えると更新日時が新しくなる() throws Exception {
		UUID id = addCard("todo", "タイトル");
		Instant before = load(id).getUpdatedAt();
		assertThat(before).isNotNull();

		patchCard(id, """
				{"title": "タイトル", "priority": "medium"}
				""").andExpect(status().isOk());

		assertThat(load(id).getUpdatedAt()).isAfter(before);
	}

	@Test
	void 更新の入力に問題があると400が返りカードは変わらない() throws Exception {
		UUID id = addCard("todo", "もとのタイトル");

		// タイトルが空白だけ
		patchCard(id, """
				{"title": "　 ", "memo": ""}
				""").andExpect(status().isBadRequest());
		// タイトルが101文字
		patchCard(id, """
				{"title": "%s"}
				""".formatted("あ".repeat(101))).andExpect(status().isBadRequest());
		// 優先度が決まった値でない
		patchCard(id, """
				{"title": "タイトル", "priority": "urgent"}
				""").andExpect(status().isBadRequest());
		// 正しくない日付
		patchCard(id, """
				{"title": "タイトル", "dueDate": "2026-02-30"}
				""").andExpect(status().isBadRequest());

		assertThat(load(id).getTitle()).isEqualTo("もとのタイトル");
	}

	@Test
	void ないカードを更新すると404が返る() throws Exception {
		patchCard(UUID.randomUUID(), """
				{"title": "タイトル"}
				""").andExpect(status().isNotFound());
	}

	// ---------- 移動 ----------

	@Test
	void 別のカラムの指定した位置へ移せる() throws Exception {
		UUID a = addCard("todo", "A");
		UUID b = addCard("todo", "B");
		UUID c = addCard("todo", "C");
		UUID d = addCard("doing", "D");
		Instant before = load(b).getUpdatedAt();

		// B を「作業中」の一番上へ（docs/データ設計.md 3.4 の図と同じ動き）
		moveCard(b, "doing", 0).andExpect(status().isNoContent());

		assertThat(load(b).getColumnId()).isEqualTo(columnId("doing"));
		assertThat(load(b).getPosition()).isZero();
		assertThat(load(b).getUpdatedAt()).isAfter(before);
		assertThat(cardIds("todo")).containsSubsequence(a, c).doesNotContain(b);
		assertThat(cardIds("doing")).containsSubsequence(b, d);
		assertNumbered("todo");
		assertNumbered("doing");
	}

	@Test
	void 別のカラムの一番下へ移せる() throws Exception {
		UUID a = addCard("todo", "A");
		UUID d = addCard("done", "D");
		int bottom = cardIds("done").size();

		moveCard(a, "done", bottom).andExpect(status().isNoContent());

		List<UUID> done = cardIds("done");
		assertThat(done.get(done.size() - 1)).isEqualTo(a);
		assertThat(done).containsSubsequence(d, a);
		assertNumbered("todo");
		assertNumbered("done");
	}

	@Test
	void 同じカラムの中で並べ替えられる() throws Exception {
		UUID a = addCard("doing", "A");
		UUID b = addCard("doing", "B");
		UUID c = addCard("doing", "C");

		// 一番下の C を、A のいた位置へ
		moveCard(c, "doing", load(a).getPosition()).andExpect(status().isNoContent());

		assertThat(cardIds("doing")).containsSubsequence(c, a, b);
		assertNumbered("doing");
	}

	@Test
	void 移動の入力に問題があると400が返りカードは動かない() throws Exception {
		UUID id = addCard("todo", "タイトル");
		int positionBefore = load(id).getPosition();

		// カラムの枚数を超える位置
		moveCard(id, "doing", cardIds("doing").size() + 1).andExpect(status().isBadRequest());
		// 同じカラムの中では、自分を抜いた枚数が上限になる
		moveCard(id, "todo", cardIds("todo").size()).andExpect(status().isBadRequest());
		// マイナスの位置
		moveCard(id, "doing", -1).andExpect(status().isBadRequest());
		// ないカラム
		moveCard(id, "later", 0).andExpect(status().isBadRequest());
		// 位置がない
		mockMvc.perform(put("/api/cards/{id}/position", id).contentType(MediaType.APPLICATION_JSON).content("""
				{"columnKey": "doing"}
				""")).andExpect(status().isBadRequest());

		assertThat(load(id).getColumnId()).isEqualTo(columnId("todo"));
		assertThat(load(id).getPosition()).isEqualTo(positionBefore);
	}

	@Test
	void ないカードを移動すると404が返る() throws Exception {
		moveCard(UUID.randomUUID(), "doing", 0).andExpect(status().isNotFound());
	}

	// ---------- 削除 ----------

	@Test
	void カードを削除するとデータベースから消える() throws Exception {
		UUID id = addCard("todo", "消すカード");

		deleteCard(id).andExpect(status().isNoContent());

		entityManager.flush();
		entityManager.clear();
		assertThat(cardRepository.findById(id)).isEmpty();
	}

	@Test
	void 削除したあとも同じカラムの並び順がすき間なく続く() throws Exception {
		UUID a = addCard("doing", "A");
		UUID b = addCard("doing", "B");
		UUID c = addCard("doing", "C");
		UUID d = addCard("done", "D");
		int donePositionBefore = load(d).getPosition();

		// まん中の B を消す
		deleteCard(b).andExpect(status().isNoContent());

		assertThat(cardIds("doing")).containsSubsequence(a, c).doesNotContain(b);
		assertNumbered("doing");
		// ほかのカラムのカードは変わらない
		assertThat(load(d).getPosition()).isEqualTo(donePositionBefore);
	}

	@Test
	void ないカードを削除すると404が返る() throws Exception {
		deleteCard(UUID.randomUUID()).andExpect(status().isNotFound());
	}

	// ---------- 道具 ----------

	private UUID addCard(String columnKey, String title) throws Exception {
		UUID id = UUID.randomUUID();
		postJson("""
				{"id": "%s", "columnKey": "%s", "title": "%s"}
				""".formatted(id, columnKey, title)).andExpect(status().isCreated());
		return id;
	}

	private ResultActions postJson(String json) throws Exception {
		return mockMvc.perform(post("/api/cards").contentType(MediaType.APPLICATION_JSON).content(json));
	}

	private ResultActions patchCard(UUID id, String json) throws Exception {
		return mockMvc.perform(patch("/api/cards/{id}", id).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	private ResultActions deleteCard(UUID id) throws Exception {
		return mockMvc.perform(delete("/api/cards/{id}", id));
	}

	private ResultActions moveCard(UUID id, String columnKey, int position) throws Exception {
		return mockMvc.perform(put("/api/cards/{id}/position", id).contentType(MediaType.APPLICATION_JSON).content("""
				{"columnKey": "%s", "position": %d}
				""".formatted(columnKey, position)));
	}

	// データベースに書き出してから読み直す。メモリの中の値ではなく、テーブルの値を確かめるため
	private Card load(UUID id) {
		entityManager.flush();
		entityManager.clear();
		return cardRepository.findById(id).orElseThrow();
	}

	private UUID columnId(String key) {
		return boardColumnRepository.findByKey(key).orElseThrow().getId();
	}

	// カラムのカードの id を、上から順に返す。もとからデータベースにあるカードも含む
	private List<UUID> cardIds(String columnKey) {
		entityManager.flush();
		entityManager.clear();
		return cardRepository.findByColumnIdOrderByPositionAsc(columnId(columnKey)).stream().map(Card::getId).toList();
	}

	// position が、上から 0、1、2… とすき間なく並んでいること
	private void assertNumbered(String columnKey) {
		entityManager.flush();
		entityManager.clear();
		List<Card> cards = cardRepository.findByColumnIdOrderByPositionAsc(columnId(columnKey));
		for (int i = 0; i < cards.size(); i++) {
			assertThat(cards.get(i).getPosition()).isEqualTo(i);
		}
	}

}
