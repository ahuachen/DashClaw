# Lesson: One-Click Agent Pairing (Enrollment)

## Goal

Make onboarding non-technical users viable by eliminating manual PEM/JWK copy-paste and "which keypair did I upload" support loops.

## Flow

1. Agent generates/has a keypair locally (private key never needs to leave the agent machine).
2. Agent calls `POST /api/pairings` with:
   - `agent_id`
   - `public_key` (PEM)
   - optional `agent_name`, `algorithm`
3. API returns a `pairing_url` like `/pair/<pairingId>`.
4. User clicks the link (must be logged in as an org admin) and approves.
5. Approval upserts `agent_identities` from the pairing request.
6. Agent can poll `GET /api/pairings/<pairingId>` until status becomes `approved`.

## Security Notes

- Pairing approval requires `admin` role; org context is injected by middleware.
- Clients must not rely on sending `x-org-id`/`x-org-role`; middleware strips these.
- Signing uses canonical JSON to avoid signature failures caused by object key ordering differences.

