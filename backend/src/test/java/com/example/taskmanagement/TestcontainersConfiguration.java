package com.example.taskmanagement;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;

// テスト用のデータベース。テストのたびに Docker で PostgreSQL を立ち上げ、ふだん使うデータベースには触らない。
// @ServiceConnection が付いているので、サーバーはこのデータベースにつながる（.env の接続情報は使わない）
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	PostgreSQLContainer postgresContainer() {
		// 本番と同じ版（compose.yaml）にそろえる
		return new PostgreSQLContainer("postgres:18");
	}

}
