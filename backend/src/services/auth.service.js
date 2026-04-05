"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserFromAccessToken = getUserFromAccessToken;
const supabaseClient_1 = require("../config/supabaseClient");
const httpError_1 = require("../utils/httpError");
function mapAuthUser(user) {
    const rawRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role.trim() : null;
    const normalizedRole = rawRole === 'LineProducer'
        ? 'LINE_PRODUCER'
        : rawRole === 'DataWrangler'
            ? 'DATA_WRANGLER'
            : rawRole === 'Driver'
                ? 'DRIVER'
                : rawRole;
    return {
        id: user.id,
        email: user.email ?? null,
        fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        role: normalizedRole ?? null,
        department: user.user_metadata?.department_id ?? null,
        projectRoleTitle: user.user_metadata?.project_role_title ?? null,
        userMetadata: user.user_metadata,
    };
}
async function getUserFromAccessToken(accessToken) {
    const { data, error } = await supabaseClient_1.adminClient.auth.getUser(accessToken);
    if (error || !data.user) {
        throw new httpError_1.HttpError(401, 'Invalid or expired access token.');
    }
    return mapAuthUser(data.user);
}
