package com.example.taskmanagement.board;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CardService {

	private final BoardColumnRepository boardColumnRepository;

	private final CardRepository cardRepository;

	public CardService(BoardColumnRepository boardColumnRepository, CardRepository cardRepository) {
		this.boardColumnRepository = boardColumnRepository;
		this.cardRepository = cardRepository;
	}

	// 指定したカラムの一番下に、カードを1枚加える
	@Transactional
	public CardResponse addCard(CardCreateRequest request) {
		// 同じ id で保存すると、もとのカードを書き換えてしまうので、先に確かめる
		if (cardRepository.existsById(request.id())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "同じ id のカードがすでにあります");
		}

		BoardColumn column = boardColumnRepository.findByKey(request.columnKey())
			.orElseThrow(() -> new IllegalStateException("カラムがありません：" + request.columnKey()));

		// position は 0 から振るので、今の枚数がそのまま一番下の番号になる（docs/データ設計.md 3.4）
		int position = cardRepository.countByColumnId(column.getId());

		Card card = new Card(request.id(), column.getId(), request.title(), request.memo(), request.dueDate(),
				request.priority(), position);
		return CardResponse.from(cardRepository.save(card));
	}

}
