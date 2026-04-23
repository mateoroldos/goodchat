import { describe, expect, it } from "vitest";
import {
  LOCAL_DOCKER_COMPOSE_PATH,
  LOCAL_DOCKER_UP_COMMAND,
  renderLocalDockerCompose,
} from "./database-local-docker";

describe("database local docker helpers", () => {
  it("renders postgres docker compose service", () => {
    const content = renderLocalDockerCompose("postgres");
    expect(content).toContain("image: postgres:16");
    expect(content).toContain("POSTGRES_DB: goodchat");
    expect(content).toContain('"5432:5432"');
  });

  it("renders mysql docker compose service", () => {
    const content = renderLocalDockerCompose("mysql");
    expect(content).toContain("image: mysql:8.4");
    expect(content).toContain("MYSQL_DATABASE: goodchat");
    expect(content).toContain('"3306:3306"');
  });

  it("exports compose path and up command", () => {
    expect(LOCAL_DOCKER_COMPOSE_PATH).toBe("docker-compose.yml");
    expect(LOCAL_DOCKER_UP_COMMAND).toBe("bun run db:up");
  });
});
