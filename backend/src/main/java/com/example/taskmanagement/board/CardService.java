package com.example.taskmanagement.board;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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

		BoardColumn column = findColumn(request.columnKey());

		// position は 0 から振るので、今の枚数がそのまま一番下の番号になる（docs/データ設計.md 3.4）
		int position = cardRepository.countByColumnId(column.getId());

		Card card = new Card(request.id(), column.getId(), request.title(), request.memo(), request.dueDate(),
				request.priority(), position);
		return CardResponse.from(cardRepository.save(card));
	}

	// カードの4項目を書き換える。カラムと並び順は変えない
	@Transactional
	public CardResponse updateCard(UUID id, CardUpdateRequest request) {
		Card card = findCard(id);
		card.update(request.title(), request.memo(), request.dueDate(), request.priority());
		return CardResponse.from(card);
	}

	// カードを1枚、データベースから消す。
	// 同じカラムに残ったカードの番号は、すき間がないように振り直す（docs/データ設計.md 3.4）
	@Transactional
	public void deleteCard(UUID id) {
		Card card = findCard(id);
		cardRepository.delete(card);

		List<Card> rest = new ArrayList<>(cardRepository.findByColumnIdOrderByPositionAsc(card.getColumnId()));
		rest.removeIf(other -> other.getId().equals(id));
		renumber(rest);
	}

	// カードを、指定したカラムの指定した位置へ移す。同じカラムの中の並べ替えも含む。
	// 番号の振り直しは、1つのトランザクションでまとめて行う（docs/データ設計.md 3.4）
	@Transactional
	public void moveCard(UUID id, CardMoveRequest request) {
		Card card = findCard(id);
		BoardColumn destinationColumn = findColumn(request.columnKey());
		UUID sourceColumnId = card.getColumnId();
		boolean sameColumn = sourceColumnId.equals(destinationColumn.getId());

		// 移動元のカラムから、動かすカードを抜く
		List<Card> source = new ArrayList<>(cardRepository.findByColumnIdOrderByPositionAsc(sourceColumnId));
		source.removeIf(other -> other.getId().equals(id));

		List<Card> destination = sameColumn ? source
				: new ArrayList<>(cardRepository.findByColumnIdOrderByPositionAsc(destinationColumn.getId()));
		if (request.position() > destination.size()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "移動先の位置が、カラムの枚数を超えています");
		}

		// 移動先のカラムの、指定した位置に入れる
		destination.add(request.position(), card);
		card.moveTo(destinationColumn.getId());

		if (!sameColumn) {
			renumber(source);
		}
		renumber(destination);
	}

	// 指定したカラムのカードを、渡された順番に並べ直す。
	// 優先度や期限を比べて順番を決めるのは画面の仕事で、サーバーは渡された順番をそのまま保存する（docs/基本設計書.md 2.4）
	@Transactional
	public void reorderColumn(String columnKey, List<UUID> cardIds) {
		BoardColumn column = boardColumnRepository.findByKey(columnKey)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "そのカラムはありません"));

		Map<UUID, Card> cardsById = new HashMap<>();
		for (Card card : cardRepository.findByColumnIdOrderByPositionAsc(column.getId())) {
			cardsById.put(card.getId(), card);
		}

		// 渡されたカードが、そのカラムに今入っているカードとちょうど同じであることを確かめる
		if (cardIds.size() != cardsById.size() || !new HashSet<>(cardIds).equals(cardsById.keySet())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "渡されたカードが、カラムの中身と合いません");
		}

		renumber(cardIds.stream().map(cardsById::get).toList());
	}

	// 上から 0、1、2… と番号を振り直す
	private void renumber(List<Card> cards) {
		for (int i = 0; i < cards.size(); i++) {
			cards.get(i).renumber(i);
		}
	}

	private Card findCard(UUID id) {
		return cardRepository.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "その id のカードはありません"));
	}

	private BoardColumn findColumn(String key) {
		return boardColumnRepository.findByKey(key)
			.orElseThrow(() -> new IllegalStateException("カラムがありません：" + key));
	}

}
