import { drizzleAdapter } from "better-auth/adapters/drizzle";

const database = {};

const auth = {
  options: {
    database: drizzleAdapter(database, {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
    },
  },
};

export default {
  auth,
};
