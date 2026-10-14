package com.example.taskmanagement.board;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

// 画面から送られてくる、カードの移動先。position は、移動先のカラムで上から何番目か（0から）
public record CardMoveRequest(
		@NotNull @Pattern(regexp = "todo|doing|done") String columnKey,
		@NotNull @Min(0) Integer position) {
}
