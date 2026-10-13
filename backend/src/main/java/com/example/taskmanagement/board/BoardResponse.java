package com.example.taskmanagement.board;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// 画面に返すボードの形（docs/データ設計.md 2.2）
public record BoardResponse(int version, Map<String, List<UUID>> columns, Map<UUID, CardResponse> cards) {
}
