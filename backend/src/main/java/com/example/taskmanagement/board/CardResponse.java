package com.example.taskmanagement.board;

import java.time.LocalDate;
import java.util.UUID;

// 画面に返すカードの形（docs/データ設計.md 1章）。期限と優先度は、未設定なら null
public record CardResponse(UUID id, String title, String memo, LocalDate dueDate, String priority) {

	static CardResponse from(Card card) {
		return new CardResponse(card.getId(), card.getTitle(), card.getMemo(), card.getDueDate(), card.getPriority());
	}

}
