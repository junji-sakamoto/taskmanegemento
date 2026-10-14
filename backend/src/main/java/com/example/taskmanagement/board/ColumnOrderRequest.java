package com.example.taskmanagement.board;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;

// 画面から送られてくる、カラムの新しい並び順。カードの id を、上から順に並べたもの
public record ColumnOrderRequest(@NotNull List<@NotNull UUID> cardIds) {
}
