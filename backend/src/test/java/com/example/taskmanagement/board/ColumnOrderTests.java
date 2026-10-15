package com.example.taskmanagement.board;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import com.example.taskmanagement.TestcontainersConfiguration;

// カラムの並べ替え（PUT /api/columns/{key}/order）のテスト。
// テストで入れたカードは、テストが終わるたびに取り消す
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@Transactional
class ColumnOrderTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private CardRepository cardRepository;

	@Autowired
	private BoardColumnRepository boardColumnRepository;

	@Autowired
	private EntityManager entityManager;

	@Test
	void 渡した順番に並べ直せる() throws Exception {
		addCard("doing", "A");
		addCard("doing", "B");
		List<UUID> otherColumn = cardIds("todo");
		List<UUID> reversed = new ArrayList<>(cardIds("doing"));
		Collections.reverse(reversed);

		reorder("doing", reversed).andExpect(status().isNoContent());

		assertThat(cardIds("doing")).isEqualTo(reversed);
		List<Card> cards = cards("doing");
		for (int i = 0; i < cards.size(); i++) {
			assertThat(cards.get(i).getPosition()).isEqualTo(i);
		}
		// ほかのカラムは変わらない
		assertThat(cardIds("todo")).isEqualTo(otherColumn);
	}

	@Test
	void 並べ替えでは更新日時は変わらない() throws Exception {
		UUID a = addCard("done", "A");
		addCard("done", "B");
		Instant before = cards("done").stream().filter(card -> card.getId().equals(a)).findFirst().orElseThrow()
			.getUpdatedAt();
		List<UUID> reversed = new ArrayList<>(cardIds("done"));
		Collections.reverse(reversed);

		reorder("done", reversed).andExpect(status().isNoContent());

		assertThat(cardRepository.findById(a).orElseThrow().getUpdatedAt()).isEqualTo(before);
	}

	@Test
	void カラムの中身と合わないと409が返り並び順は変わらない() throws Exception {
		addCard("doing", "A");
		addCard("doing", "B");
		UUID inOtherColumn = addCard("todo", "C");
		List<UUID> before = cardIds("doing");

		// 1枚足りない
		reorder("doing", before.subList(1, before.size())).andExpect(status().isConflict());
		// ほかのカラムのカードが混ざっている
		List<UUID> withOther = new ArrayList<>(before);
		withOther.set(0, inOtherColumn);
		reorder("doing", withOther).andExpect(status().isConflict());
		// 同じカードが2回入っている
		List<UUID> duplicated = new ArrayList<>(before);
		duplicated.set(0, before.get(1));
		reorder("doing", duplicated).andExpect(status().isConflict());

		assertThat(cardIds("doing")).isEqualTo(before);
	}

	@Test
	void 入力の形が正しくないと400が返る() throws Exception {
		mockMvc.perform(put("/api/columns/doing/order").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isBadRequest());
		mockMvc
			.perform(put("/api/columns/doing/order").contentType(MediaType.APPLICATION_JSON)
				.content("{\"cardIds\": [\"uuid-ではない\"]}"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void ないカラムを並べ替えると404が返る() throws Exception {
		reorder("later", List.of()).andExpect(status().isNotFound());
	}

	private UUID addCard(String columnKey, String title) throws Exception {
		UUID id = UUID.randomUUID();
		mockMvc.perform(post("/api/cards").contentType(MediaType.APPLICATION_JSON).content("""
				{"id": "%s", "columnKey": "%s", "title": "%s"}
				""".formatted(id, columnKey, title))).andExpect(status().isCreated());
		return id;
	}

	private ResultActions reorder(String columnKey, List<UUID> cardIds) throws Exception {
		String ids = cardIds.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(", "));
		return mockMvc.perform(put("/api/columns/{key}/order", columnKey).contentType(MediaType.APPLICATION_JSON)
			.content("{\"cardIds\": [" + ids + "]}"));
	}

	// データベースに書き出してから読み直す。メモリの中の値ではなく、テーブルの値を確かめるため
	private List<Card> cards(String columnKey) {
		entityManager.flush();
		entityManager.clear();
		UUID columnId = boardColumnRepository.findByKey(columnKey).orElseThrow().getId();
		return cardRepository.findByColumnIdOrderByPositionAsc(columnId);
	}

	// カラムのカードの id を、上から順に返す。もとからデータベースにあるカードも含む
	private List<UUID> cardIds(String columnKey) {
		return cards(columnKey).stream().map(Card::getId).toList();
	}

}
