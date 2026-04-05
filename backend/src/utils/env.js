"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.isProduction = isProduction;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
exports.env = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 5000),
    jwtSecret: requireEnv('JWT_SECRET'),
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
};
function isProduction() {
    return exports.env.nodeEnv === 'production';
}
