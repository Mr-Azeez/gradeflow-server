"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for avatar uploads");
}
// Service role client - server-side only. Never expose this key to the frontend.
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, serviceRoleKey);
