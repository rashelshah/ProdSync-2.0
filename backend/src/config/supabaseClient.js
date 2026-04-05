"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminClient = exports.publicClient = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../utils/env");
console.log('[supabase] clients initialized', {
    urlHost: new URL(env_1.env.supabaseUrl).host,
});
exports.publicClient = (0, supabase_js_1.createClient)(env_1.env.supabaseUrl, env_1.env.supabaseAnonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
exports.adminClient = (0, supabase_js_1.createClient)(env_1.env.supabaseUrl, env_1.env.supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
