package com.example.taskmanagement.board;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

// cards テーブルの1行
@Entity
@Table(name = "cards")
public class Card {

	@Id
	private UUID id;

	@Column(name = "column_id")
	private UUID columnId;

	private String title;

	private String memo;

	@Column(name = "due_date")
	private LocalDate dueDate;

	private String priority;

	private int position;

	protected Card() {
	}

	public UUID getId() {
		return id;
	}

	public UUID getColumnId() {
		return columnId;
	}

	public String getTitle() {
		return title;
	}

	public String getMemo() {
		return memo;
	}

	public LocalDate getDueDate() {
		return dueDate;
	}

	public String getPriority() {
		return priority;
	}

	public int getPosition() {
		return position;
	}

}
