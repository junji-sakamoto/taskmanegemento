package com.example.taskmanagement.board;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// 画面に返すカードの形（docs/データ設計.md 1章）。期限と優先度は、未設定なら null。
// 作成日時と更新日時は、画面に見せるためだけに返す。バックアップのファイルには入れない
public record CardResponse(UUID id, String title, String memo, LocalDate dueDate, String priority,
		Instant createdAt, Instant updatedAt) {

	static CardResponse from(Card card) {
		return new CardResponse(card.getId(), card.getTitle(), card.getMemo(), card.getDueDate(), card.getPriority(),
				card.getCreatedAt(), card.getUpdatedAt());
	}

}
