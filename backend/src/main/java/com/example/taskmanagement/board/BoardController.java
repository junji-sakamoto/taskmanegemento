package com.example.taskmanagement.board;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// ボードの窓口（docs/基本設計書.md 3章）
@RestController
@RequestMapping("/api/board")
public class BoardController {

	private final BoardService boardService;

	public BoardController(BoardService boardService) {
		this.boardService = boardService;
	}

	@GetMapping
	public BoardResponse getBoard() {
		return boardService.getBoard();
	}

}
