package com.example.taskmanagement.board;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// カラムの窓口（docs/基本設計書.md 3章）
@RestController
@RequestMapping("/api/columns")
public class ColumnController {

	private final CardService cardService;

	public ColumnController(CardService cardService) {
		this.cardService = cardService;
	}

	@PutMapping("/{key}/order")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void reorderColumn(@PathVariable String key, @Valid @RequestBody ColumnOrderRequest request) {
		cardService.reorderColumn(key, request.cardIds());
	}

}
