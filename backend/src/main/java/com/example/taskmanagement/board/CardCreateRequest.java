package com.example.taskmanagement.board;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// 画面から送られてくる、追加するカードの形。チェックのルールは docs/画面設計.md 10章
public record CardCreateRequest(
		// id は画面の側で作る（docs/データ設計.md 2.2）
		@NotNull UUID id,
		@NotNull @Pattern(regexp = "todo|doing|done") String columnKey,
		@NotBlank @Size(max = 100) String title,
		@NotNull @Size(max = 1000) String memo,
		LocalDate dueDate,
		@Pattern(regexp = "high|medium|low") String priority) {

	// タイトルの前後の空白を取り除く。メモが未入力なら、空の文字にする
	public CardCreateRequest {
		title = title == null ? null : title.strip();
		memo = memo == null ? "" : memo;
	}

}
