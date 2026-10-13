package com.example.taskmanagement.board;

import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

// columns テーブルの1行。カラムは画面から増やしたり消したりしないので、読むだけ
@Entity
@Table(name = "columns")
public class BoardColumn {

	@Id
	private UUID id;

	private String key;

	private String name;

	private int position;

	protected BoardColumn() {
	}

	public UUID getId() {
		return id;
	}

	public String getKey() {
		return key;
	}

	public String getName() {
		return name;
	}

	public int getPosition() {
		return position;
	}

}
