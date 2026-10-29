# Private MCP pilot — 2026-10-29

This release enables operator-only developer-key management, not a public paid launch. Existing Firebase administrators can explicitly request one 7-day allowance of 25 operations for each of six metrics. Repeating the request never resets used units, suspended grants or expired periods. Other current/future overlapping allowances fail closed. The allowance endpoint accepts no caller owner, limit or period.

`/developers/` uses the existing account login and presents key issue/revoke and allowance balances. Tokens exist once in browser memory and are never rendered or persisted. `/api/mcp/` supports explicit Bearer developer keys with read/write/collection scopes. Key management itself requires verified login. Production keeps the Firebase-token MCP bypass disabled.

Additive migration: `db/developer-api-schema.sql`. Collection sessions use the already deployed `logo_wall_collection_sessions` table. Runtime flags: `SEMOLOGO_MCP_ENABLED`, `SEMOLOGO_DEVELOPER_API_ENABLED`, `SEMOLOGO_DEVELOPER_PILOT_ONLY`, `SEMOLOGO_PILOT_GRANTS_ENABLED`; operator-only flags are 1. `SEMOLOGO_MCP_LOGIN_PILOT_ENABLED=0`. The key pepper remains server-private. Rollback: restore the preceding image/runtime flags; preserve the additive tables and user walls.

NICEPAY order/payment code is excluded from this deployment. No prices, subscriptions, checkout, public OAuth registration, or payment entitlement are activated. API-key clients are the pilot integration mode. Actual end-user client integration and production SDK verification must be recorded separately from local fixture tests.

Verification: isolated PostgreSQL API/pilot checks, bounded-body route checks, console model/UI tests, TypeScript and production build; live deployment and actual SDK evidence are recorded under `ops/evidence/private-mcp-pilot-20261029/` when completed. New local verification alone does not establish live success.
