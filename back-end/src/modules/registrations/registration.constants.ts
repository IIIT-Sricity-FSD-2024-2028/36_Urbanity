// Requested default for Community Admins provisioned through registration.
// Persist only its bcrypt hash; never return it in API/email payloads or logs.
export const DEFAULT_COMMUNITY_ADMIN_PASSWORD = '1234567890';
