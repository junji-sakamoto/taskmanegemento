package com.example.taskmanagement.board;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BoardService {

	// データの形の版（docs/データ設計.md 2.2）
	private static final int VERSION = 1;

	private final BoardColumnRepository boardColumnRepository;

	private final CardRepository cardRepository;

	public BoardService(BoardColumnRepository boardColumnRepository, CardRepository cardRepository) {
		this.boardColumnRepository = boardColumnRepository;
		this.cardRepository = cardRepository;
	}

	// テーブルの行を、ボードの形に組み立てる
	@Transactional(readOnly = true)
	public BoardResponse getBoard() {
		// カードが 0 枚のカラムも、空の配列で必ず入れる
		Map<String, List<UUID>> columns = new LinkedHashMap<>();
		Map<UUID, List<UUID>> cardIdsByColumnId = new HashMap<>();
		for (BoardColumn column : boardColumnRepository.findAllByOrderByPositionAsc()) {
			List<UUID> cardIds = new ArrayList<>();
			columns.put(column.getKey(), cardIds);
			cardIdsByColumnId.put(column.getId(), cardIds);
		}

		// position の順に読んでいるので、足した順番がそのままカラムの中の並び順になる
		Map<UUID, CardResponse> cards = new LinkedHashMap<>();
		for (Card card : cardRepository.findAllByOrderByPositionAsc()) {
			cardIdsByColumnId.get(card.getColumnId()).add(card.getId());
			cards.put(card.getId(), CardResponse.from(card));
		}

		return new BoardResponse(VERSION, columns, cards);
	}

}
