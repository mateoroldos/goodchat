export type LocalDockerService = "postgres" | "mysql";

export const LOCAL_DOCKER_COMPOSE_PATH = "docker-compose.yml";
export const LOCAL_DOCKER_UP_COMMAND = "bun run db:up";

export const renderLocalDockerCompose = (
  service: LocalDockerService
): string => {
  if (service === "postgres") {
    return `services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: goodchat
      POSTGRES_PASSWORD: goodchat
      POSTGRES_DB: goodchat
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U goodchat -d goodchat"]
      interval: 2s
      timeout: 5s
      retries: 30
      start_period: 10s
`;
  }

  return `services:
  mysql:
    image: mysql:8.4
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: goodchat
      MYSQL_DATABASE: goodchat
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -pgoodchat"]
      interval: 1s
      timeout: 5s
      retries: 30
      start_period: 10s
`;
};
