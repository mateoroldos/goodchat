import { drizzleAdapter } from "better-auth/adapters/drizzle";

const database = {};

const auth = {
  options: {
    database: drizzleAdapter(database, {
      provider: "pg",
    }),
    emailAndPassword: {
      enabled: true,
    },
  },
};

export default {
  auth,
};
