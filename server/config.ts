import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'livequiz-super-secret-key-change-in-production-2026',
  frontendUrl: process.env.FRONTEND_URL || '*',
  adminEmail: process.env.ADMIN_DEFAULT_EMAIL || 'admin@college.edu',
  adminPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'AdminCollege2026!',
  isProduction: process.env.NODE_ENV === 'production',
};
