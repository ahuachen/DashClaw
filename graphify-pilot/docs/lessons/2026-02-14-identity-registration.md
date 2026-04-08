# Lesson: Registering Agent Public Keys (Identity Binding)

## Symptom

You have an agent configured with a private key (signing enabled), but actions are not marked `verified`, or identity registration fails with:

- `403 { "error": "Admin access required" }` from `POST /api/identities`

## Root Cause

`POST /api/identities` checks `x-org-role` and only allows `admin`.

If `/api/identities` is not treated as a protected route by `middleware.js`, the middleware never injects org context (`x-org-id`, `x-org-role`), so the API route defaults the role to `member` and rejects the request.

## Correct Flow

1. Generate a keypair for the agent.
2. Give the agent the private key (JWK/CryptoKey) so it can sign action payloads.
3. Register the matching public key PEM with DashClaw:
   - `POST /api/identities`
   - Header: `x-api-key: <admin key>`
   - Body: `{ agent_id, algorithm, public_key }`
4. Verify registration:
   - `GET /api/identities` should list the agent ID

## Notes

- Do not send `x-org-id`/`x-org-role` from clients. Middleware strips externally-supplied org headers for security.
- If you see 403s, double check you are using an admin key and the route is included in `PROTECTED_ROUTES` in `middleware.js`.
