package com.example.taskmanagement.board;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

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

// テストで入れたカードは、テストが終わるたびに取り消す
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@AutoConfigureMockMvc
@Transactional
class CardControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private CardRepository cardRepository;

	@Test
	void カードを追加すると201が返りデータベースに入る() throws Exception {
		UUID id = UUID.randomUUID();

		postCard("""
				{"id": "%s", "columnKey": "todo", "title": "  買い物に行く  ", "memo": "牛乳",
				 "dueDate": "2026-10-15", "priority": "high"}
				""".formatted(id))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").value(id.toString()))
			.andExpect(jsonPath("$.title").value("買い物に行く"))
			.andExpect(jsonPath("$.memo").value("牛乳"))
			.andExpect(jsonPath("$.dueDate").value("2026-10-15"))
			.andExpect(jsonPath("$.priority").value("high"));

		Card card = cardRepository.findById(id).orElseThrow();
		assertThat(card.getTitle()).isEqualTo("買い物に行く");
	}

	@Test
	void 追加したカードはカラムの一番下に入る() throws Exception {
		UUID first = UUID.randomUUID();
		UUID second = UUID.randomUUID();

		postCard(cardJson(first, "doing", "1枚目")).andExpect(status().isCreated());
		postCard(cardJson(second, "doing", "2枚目")).andExpect(status().isCreated());

		assertThat(cardRepository.findById(second).orElseThrow().getPosition())
			.isEqualTo(cardRepository.findById(first).orElseThrow().getPosition() + 1);
		mockMvc.perform(get("/api/board"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.columns.doing[-2]").value(first.toString()))
			.andExpect(jsonPath("$.columns.doing[-1]").value(second.toString()));
	}

	@Test
	void メモと期限と優先度は省略できる() throws Exception {
		UUID id = UUID.randomUUID();

		postCard("""
				{"id": "%s", "columnKey": "done", "title": "タイトルだけ"}
				""".formatted(id))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.memo").value(""))
			.andExpect(jsonPath("$.dueDate").isEmpty())
			.andExpect(jsonPath("$.priority").isEmpty());
	}

	@Test
	void 入力に問題があると400が返りデータベースに入らない() throws Exception {
		long before = cardRepository.count();

		// タイトルが空白だけ
		postCard(cardJson(UUID.randomUUID(), "todo", "　 ")).andExpect(status().isBadRequest());
		// タイトルが101文字
		postCard(cardJson(UUID.randomUUID(), "todo", "あ".repeat(101))).andExpect(status().isBadRequest());
		// ないカラム
		postCard(cardJson(UUID.randomUUID(), "later", "タイトル")).andExpect(status().isBadRequest());
		// 優先度が決まった値でない
		postCard("""
				{"id": "%s", "columnKey": "todo", "title": "タイトル", "priority": "urgent"}
				""".formatted(UUID.randomUUID())).andExpect(status().isBadRequest());
		// 正しくない日付
		postCard("""
				{"id": "%s", "columnKey": "todo", "title": "タイトル", "dueDate": "2026-02-30"}
				""".formatted(UUID.randomUUID())).andExpect(status().isBadRequest());
		// メモが1001文字
		postCard("""
				{"id": "%s", "columnKey": "todo", "title": "タイトル", "memo": "%s"}
				""".formatted(UUID.randomUUID(), "あ".repeat(1001))).andExpect(status().isBadRequest());
		// id がない
		postCard("""
				{"columnKey": "todo", "title": "タイトル"}
				""").andExpect(status().isBadRequest());

		assertThat(cardRepository.count()).isEqualTo(before);
	}

	@Test
	void 同じidのカードがあると409が返りもとのカードは変わらない() throws Exception {
		UUID id = UUID.randomUUID();
		postCard(cardJson(id, "todo", "もとのカード")).andExpect(status().isCreated());

		postCard(cardJson(id, "done", "あとから送ったカード")).andExpect(status().isConflict());

		assertThat(cardRepository.findById(id).orElseThrow().getTitle()).isEqualTo("もとのカード");
	}

	private ResultActions postCard(String json) throws Exception {
		return mockMvc.perform(post("/api/cards").contentType(MediaType.APPLICATION_JSON).content(json));
	}

	private static String cardJson(UUID id, String columnKey, String title) {
		return """
				{"id": "%s", "columnKey": "%s", "title": "%s"}
				""".formatted(id, columnKey, title);
	}

}
