package com.example.taskmanagement.board;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

import org.springframework.data.domain.Persistable;

// cards テーブルの1行。
// id は画面の側で作るので、新しいカードかどうかを id の有無では見分けられない。
// そこで Persistable で自分から知らせ、保存のときに余分な SELECT が走らないようにする
@Entity
@Table(name = "cards")
public class Card implements Persistable<UUID> {

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

	// 作成日時（created_at）は、データベースが自動で入れる。更新日時は、サーバーが入れる
	@Column(name = "updated_at")
	private Instant updatedAt;

	// まだデータベースに入れていないカードか。テーブルの列ではない
	@Transient
	private boolean isNew = true;

	protected Card() {
	}

	public Card(UUID id, UUID columnId, String title, String memo, LocalDate dueDate, String priority, int position) {
		this.id = id;
		this.columnId = columnId;
		this.title = title;
		this.memo = memo;
		this.dueDate = dueDate;
		this.priority = priority;
		this.position = position;
		this.updatedAt = Instant.now();
	}

	// カードの4項目を書き換える
	public void update(String title, String memo, LocalDate dueDate, String priority) {
		this.title = title;
		this.memo = memo;
		this.dueDate = dueDate;
		this.priority = priority;
		this.updatedAt = Instant.now();
	}

	// カードを、指定したカラムへ移す。同じカラムの中の並べ替えでも使う
	public void moveTo(UUID columnId) {
		this.columnId = columnId;
		this.updatedAt = Instant.now();
	}

	// 番号の振り直し。ほかのカードが動いたせいで番号が変わるだけなので、更新日時は変えない
	public void renumber(int position) {
		this.position = position;
	}

	// データベースから読んだときと、データベースに入れると決めたときから、新しいカードではない
	@PostLoad
	@PrePersist
	void markNotNew() {
		this.isNew = false;
	}

	@Override
	public boolean isNew() {
		return isNew;
	}

	@Override
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

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
