package com.example.taskmanagement.board;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// 画面から送られてくる、書き換えたあとのカードの形。チェックのルールは docs/画面設計.md 10章。
// 4項目を毎回すべて受け取る。期限と優先度は、null なら「未設定にする」という意味になる
public record CardUpdateRequest(
		@NotBlank @Size(max = 100) String title,
		@NotNull @Size(max = 1000) String memo,
		LocalDate dueDate,
		@Pattern(regexp = "high|medium|low") String priority) {

	// タイトルの前後の空白を取り除く。メモが未入力なら、空の文字にする
	public CardUpdateRequest {
		title = title == null ? null : title.strip();
		memo = memo == null ? "" : memo;
	}

}
