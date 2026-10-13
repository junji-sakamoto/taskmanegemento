package com.example.taskmanagement.board;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardColumnRepository extends JpaRepository<BoardColumn, UUID> {

	// カラムを左から順に読む
	List<BoardColumn> findAllByOrderByPositionAsc();

}
