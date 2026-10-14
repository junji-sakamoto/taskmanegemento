package com.example.taskmanagement.board;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// カードの窓口（docs/基本設計書.md 3章）
@RestController
@RequestMapping("/api/cards")
public class CardController {

	private final CardService cardService;

	public CardController(CardService cardService) {
		this.cardService = cardService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public CardResponse addCard(@Valid @RequestBody CardCreateRequest request) {
		return cardService.addCard(request);
	}

}
