package com.example.taskmanagement.board;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CardRepository extends JpaRepository<Card, UUID> {

	// カードを上から順に読む
	List<Card> findAllByOrderByPositionAsc();

}
