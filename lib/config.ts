// ---------------------------------------------------------------------------
// Application configuration.
// Mirrors Laravel's config/app.php + config/database.php + config/mail.php,
// reading the same .env keys the PHP stack used.
// ---------------------------------------------------------------------------

function env(key: string, fallback = ''): string {
  const v = process.env[key];
  if (v === undefined || v === null || v === '') return fallback;
  // Laravel writes literal "null"/"false"/"true" into .env; normalise the first.
  return v === 'null' ? fallback : v;
}

function envBool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1' || v === 'on';
}

function envInt(key: string, fallback: number): number {
  const n = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  app: {
    name: env('APP_NAME', 'Infix Biz'),
    env: env('APP_ENV', 'production'),
    key: env('APP_KEY'),
    debug: envBool('APP_DEBUG', false),
    url: env('APP_URL', 'http://localhost:3000'),
    sync: envBool('APP_SYNC', false),
  },

  db: {
    host: env('DB_HOST', 'localhost'),
    port: envInt('DB_PORT', 3306),
    database: env('DB_DATABASE', 'software_erp'),
    user: env('DB_USERNAME', 'root'),
    password: env('DB_PASSWORD', ''),
    // Laravel used utf8mb4_unicode_ci; keep the same connection charset.
    charset: 'utf8mb4',
  },

  session: {
    // Laravel's SESSION_LIFETIME is in minutes.
    lifetimeMinutes: envInt('SESSION_LIFETIME', 120),
    cookie: env('SESSION_COOKIE', 'infix_biz_session'),
    secret: env('SESSION_SECRET') || env('APP_KEY', 'infix-biz-dev-secret'),
  },

  mail: {
    mailer: env('MAIL_MAILER', 'sendmail'),
    host: env('MAIL_HOST'),
    port: envInt('MAIL_PORT', 587),
    username: env('MAIL_USERNAME'),
    password: env('MAIL_PASSWORD'),
    encryption: env('MAIL_ENCRYPTION'),
    fromAddress: env('MAIL_FROM_ADDRESS', 'support@spondonit.com'),
    fromName: env('MAIL_FROM_NAME') || env('APP_NAME', 'Infix Biz'),
  },

  storage: {
    root: env('STORAGE_ROOT', './storage'),
    publicUploadDir: env('PUBLIC_UPLOAD_DIR', './public/uploads'),
  },

  aws: {
    accessKeyId: env('AWS_ACCESS_KEY_ID'),
    secretAccessKey: env('AWS_SECRET_ACCESS_KEY'),
    region: env('AWS_DEFAULT_REGION', 'us-east-1'),
    bucket: env('AWS_BUCKET'),
  },
} as const;

export type AppConfig = typeof config;
