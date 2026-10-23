// Platform values are read at use time. See the Webdev service/authentication skills.
export const ENV = {
  get dbUrl() {
    if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER) {
      const host = process.env.DB_HOST;
      const port = process.env.DB_PORT ?? "3306";
      const name = encodeURIComponent(process.env.DB_NAME);
      const user = encodeURIComponent(process.env.DB_USER);
      const pass = encodeURIComponent(process.env.DB_PASS ?? "");
      return `mysql://${user}:${pass}@${host}:${port}/${name}`;
    }
    return process.env.DATABASE_URL ?? "";
  },
  get webUrl() { return process.env.RUTA_WEB ?? ""; },
  get installKey() { return process.env.INSTALL_KEY ?? ""; },
  get appId() { return process.env.APP_ID ?? process.env.MANUS_PROJECT_ID ?? "ruletaflex"; },
  get cookieSecret() { return process.env.SESSION_SECRET ?? process.env.MANUS_JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.MANUS_OAUTH_API_URL ?? ""; },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY ?? ""; },
};
