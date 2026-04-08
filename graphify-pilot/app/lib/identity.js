import crypto from 'crypto';
import { canonicalJsonStringify } from './canonical-json.js';

/**
 * Verify a cryptographic signature from an agent.
 * 
 * @param {string} orgId 
 * @param {string} agentId 
 * @param {Object} payload - The JSON object that was signed
 * @param {string} signature - Base64 encoded signature
 * @param {Function} sql - DB connection
 * @returns {Promise<boolean>}
 */
export async function verifyAgentSignature(orgId, agentId, payload, signature, sql) {
  try {
    const rows = await sql`
      SELECT public_key, algorithm 
      FROM agent_identities 
      WHERE org_id = ${orgId} AND agent_id = ${agentId} 
      LIMIT 1
    `;
    
    if (rows.length === 0) return false;
    
    const { public_key, algorithm } = rows[0];
    
    // Use canonical JSON so key order does not break verification.
    const stringToVerify = canonicalJsonStringify(payload);
    
    // Map algorithm names if necessary. SDK uses RSASSA-PKCS1-v1_5.
    // We assume SHA-256 for the digest.
    const verifyAlgo = algorithm === 'RSASSA-PKCS1-v1_5' ? 'RSA-SHA256' : algorithm;
    
    const verifier = crypto.createVerify(verifyAlgo);
    verifier.update(stringToVerify);
    return verifier.verify(public_key, signature, 'base64');
  } catch (err) {
    console.warn('[Identity] Verification error for %s:', agentId, err.message);
    return false;
  }
}
