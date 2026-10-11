/**
 * BankSim Blue-Team Rule Engine
 * Deterministic heuristic checks, parameter validation, and signature-based pattern detection.
 *
 * NOTE: Deterministic pattern matching and regex provide crucial defense-in-depth,
 * but cannot detect all semantic or novel prompt injections. This is why BankSim
 * couples deterministic validation with semantic AI analysis in a hybrid pipeline.
 */

export const THREAT_CATEGORIES = {
  NONE: 'NONE',
  PROMPT_INJECTION: 'PROMPT_INJECTION',
  MALICIOUS_PAYLOAD: 'MALICIOUS_PAYLOAD',
  OBFUSCATED_ATTACK: 'OBFUSCATED_ATTACK',
  AMBIGUOUS_REQUEST: 'AMBIGUOUS_REQUEST',
  UNAUTHORIZED_INTENT: 'UNAUTHORIZED_INTENT',
  INPUT_VALIDATION_ERROR: 'INPUT_VALIDATION_ERROR'
};

// Known prompt injection and jailbreak signatures
const PROMPT_INJECTION_PATTERNS = [
  /system\s+override/i,
  /ignore\s+(all\s+)?(previous|prior|system)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|safety)\s+(instructions|rules|guidelines)/i,
  /you\s+are\s+now\s+(in\s+)?(developer|dan|god|root|unrestricted|maintenance)\s+mode/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /bypass\s+(the\s+)?(safety|firewall|guardrail|security|rules)/i,
  /pretend\s+you\s+have\s+no\s+(rules|restrictions|limits)/i,
  /roleplay\s+as\s+(an\s+unrestricted|a\s+hacker|an\s+evil)/i,
  /repeat\s+(the\s+)?(system\s+prompt|instructions\s+above)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions)/i,
  /developer\s+mode\s+enabled/i,
  /override\s+authorization/i,
  /grant\s+(root|admin|superuser)\s+privileges/i
];

// Malicious code, injection, and exploit signatures
const MALICIOUS_PAYLOAD_PATTERNS = [
  // XSS & Script tags
  /<\s*script\b[^>]*>/i,
  /javascript\s*:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /<\s*iframe\b[^>]*>/i,
  /<\s*svg\b[^>]*onload/i,

  // SQL Injection
  /;\s*drop\s+table/i,
  /;\s*delete\s+from/i,
  /union\s+select/i,
  /'\s*or\s*'?\d+'?\s*=\s*'?\d+/i,
  /'\s*or\s*'1'\s*=\s*'1'/i,
  /--\s*$/m,
  /\/\*[\s\S]*?\*\//,

  // Command injection
  /;\s*(rm|cat|ls|curl|wget|powershell|cmd|sh|bash)\b/i,
  /\|\s*(bash|sh|powershell)\b/i
];

// Obfuscation indicators
const OBFUSCATED_PATTERNS = [
  /1gn0r3/i,
  /0v3rr1d3/i,
  /p@ssw0rd/i,
  /h@ck/i,
  /[\u200B-\u200D\uFEFF]/ // Zero-width spaces used to evade regex
];

// Base64 pattern detection (at least 16 continuous base64 characters)
const BASE64_CANDIDATE = /[A-Za-z0-9+/]{16,}={0,2}/g;

/**
 * Validates syntax, types, and constraints for inputs
 */
export function validateInputFields({ request, amount, recipientId, memo }) {
  if (typeof request !== 'string') {
    return {
      valid: false,
      error: 'Request field must be a valid text string.'
    };
  }

  const trimmedRequest = request.trim();
  if (trimmedRequest.length === 0) {
    return {
      valid: false,
      error: 'Request cannot be empty. Please enter an instruction or inquiry.'
    };
  }

  if (trimmedRequest.length > 1500) {
    return {
      valid: false,
      error: `Request length (${trimmedRequest.length} chars) exceeds security limit of 1500 characters.`
    };
  }

  if (memo && typeof memo === 'string' && memo.length > 500) {
    return {
      valid: false,
      error: `Transaction memo length (${memo.length} chars) exceeds security limit of 500 characters.`
    };
  }

  if (recipientId && typeof recipientId === 'string' && recipientId.length > 50) {
    return {
      valid: false,
      error: 'Recipient identifier exceeds maximum permitted length of 50 characters.'
    };
  }

  // Validate amount if present
  if (amount !== undefined && amount !== null && amount !== '') {
    const numAmount = Number(amount);
    if (Number.isNaN(numAmount)) {
      return {
        valid: false,
        error: 'Amount must be a valid numeric value.'
      };
    }

    if (numAmount <= 0) {
      return {
        valid: false,
        error: 'Transfer amount must be strictly greater than $0.00. Negative or zero values are rejected.'
      };
    }

    if (numAmount > 10000) {
      return {
        valid: false,
        error: 'Transfer amount exceeds maximum mock simulation cap of $10,000.00 per transaction.'
      };
    }

    // Check decimal precision (at most 2 decimals for currency)
    const amountStr = String(amount);
    if (amountStr.includes('.')) {
      const decimals = amountStr.split('.')[1];
      if (decimals && decimals.length > 2) {
        return {
          valid: false,
          error: 'Amount cannot exceed 2 decimal places for standard currency precision.'
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Tests for obfuscated base64 payloads that encode forbidden instructions
 */
function inspectBase64Payloads(text) {
  if (!text) return null;
  const matches = text.match(BASE64_CANDIDATE);
  if (!matches) return null;

  for (const match of matches) {
    try {
      const decoded = Buffer.from(match, 'base64').toString('utf-8');
      // If the decoded text is readable ASCII and contains dangerous trigger words
      if (/^[\x20-\x7E\r\n\t]+$/.test(decoded)) {
        if (/ignore|override|system|bypass|admin|root|transfer|send|hack/i.test(decoded)) {
          return {
            detected: true,
            encoded: match,
            decodedSnippet: decoded.slice(0, 50)
          };
        }
      }
    } catch {
      // Ignore base64 decode failures
    }
  }
  return null;
}

/**
 * Deterministic Rule-Based Firewall Engine
 */
export function evaluateRules({ request, amount, recipientId, memo }) {
  const reqText = (request || '').trim();
  const memoText = (memo || '').trim();
  const combinedText = `${reqText} ${memoText}`;

  // 1. Basic field validation
  const validation = validateInputFields({ request, amount, recipientId, memo });
  if (!validation.valid) {
    return {
      status: 'BLOCKED',
      risk_score: 80,
      threat_category: THREAT_CATEGORIES.INPUT_VALIDATION_ERROR,
      explanation: validation.error,
      intent: 'UNKNOWN',
      transaction_allowed: false,
      matched_rule: 'INPUT_FIELD_VALIDATION'
    };
  }

  // 2. Check for Prompt Injections (both request & memo)
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(reqText) || pattern.test(memoText)) {
      return {
        status: 'BLOCKED',
        risk_score: 98,
        threat_category: THREAT_CATEGORIES.PROMPT_INJECTION,
        explanation: 'Deterministic firewall detected adversarial prompt override signature attempting to alter system instructions.',
        intent: 'MALICIOUS_OVERRIDE',
        transaction_allowed: false,
        matched_rule: `PROMPT_INJECTION_SIGNATURE (${pattern.source})`
      };
    }
  }

  // 3. Check for Malicious Payloads (XSS, SQLi, Shell commands)
  for (const pattern of MALICIOUS_PAYLOAD_PATTERNS) {
    if (pattern.test(reqText) || pattern.test(memoText)) {
      return {
        status: 'BLOCKED',
        risk_score: 95,
        threat_category: THREAT_CATEGORIES.MALICIOUS_PAYLOAD,
        explanation: 'Deterministic firewall detected hostile script or injection payload syntax in untrusted input or transaction memo.',
        intent: 'MALICIOUS_OVERRIDE',
        transaction_allowed: false,
        matched_rule: `MALICIOUS_PAYLOAD_SIGNATURE (${pattern.source})`
      };
    }
  }

  // 4. Check for Obfuscated / Evasion attacks
  const b64Check = inspectBase64Payloads(reqText) || inspectBase64Payloads(memoText);
  if (b64Check) {
    return {
      status: 'BLOCKED',
      risk_score: 90,
      threat_category: THREAT_CATEGORIES.OBFUSCATED_ATTACK,
      explanation: `Detected base64-encoded command payload decoding to sensitive instruction keyword: "${b64Check.decodedSnippet}".`,
      intent: 'MALICIOUS_OVERRIDE',
      transaction_allowed: false,
      matched_rule: 'OBFUSCATED_BASE64_PAYLOAD'
    };
  }

  for (const pattern of OBFUSCATED_PATTERNS) {
    if (pattern.test(reqText) || pattern.test(memoText)) {
      return {
        status: 'BLOCKED',
        risk_score: 88,
        threat_category: THREAT_CATEGORIES.OBFUSCATED_ATTACK,
        explanation: 'Detected leetspeak evasion or hidden character pattern designed to bypass security filters.',
        intent: 'MALICIOUS_OVERRIDE',
        transaction_allowed: false,
        matched_rule: `OBFUSCATED_STRING (${pattern.source})`
      };
    }
  }

  // 5. Intent and Ambiguity Analysis
  const isTransferIntent = /\b(transfer|send|wire|pay|forward|move\s+funds|remit)\b/i.test(reqText);
  const isBalanceIntent = /\b(balance|funds|inquiry|check\s+account|how\s+much|statement)\b/i.test(reqText);

  // Transfer Ambiguity Check
  if (isTransferIntent) {
    const hasExplicitAmount = amount !== undefined && amount !== null && amount !== '' && Number(amount) > 0;
    const hasRecipient = recipientId !== undefined && recipientId !== null && recipientId.trim().length > 0;

    // Check for vague phrases in request
    const isVague = /\b(some\s+(money|cash)|a\s+bit|whatever|all\s+my|whenever|to\s+my\s+friend|to\s+someone)\b/i.test(reqText);

    if (isVague || !hasExplicitAmount || !hasRecipient) {
      return {
        status: 'BLOCKED',
        risk_score: 65,
        threat_category: THREAT_CATEGORIES.AMBIGUOUS_REQUEST,
        explanation: 'Transfer intent detected, but mandatory parameters (explicit positive amount, verified recipient ID) are missing or ambiguous.',
        intent: 'AMBIGUOUS_TRANSFER',
        transaction_allowed: false,
        matched_rule: 'AMBIGUOUS_FINANCIAL_PARAMETERS'
      };
    }

    // Recipient format validation
    const trimmedRecipient = recipientId.trim();
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(trimmedRecipient)) {
      return {
        status: 'BLOCKED',
        risk_score: 75,
        threat_category: THREAT_CATEGORIES.INPUT_VALIDATION_ERROR,
        explanation: `Recipient identifier '${trimmedRecipient}' contains illegal characters or is outside length limits (3-20 alphanumeric chars).`,
        intent: 'TRANSFER',
        transaction_allowed: false,
        matched_rule: 'INVALID_RECIPIENT_FORMAT'
      };
    }

    // Valid transfer request passed deterministic filters
    return {
      status: 'APPROVED',
      risk_score: 5,
      threat_category: THREAT_CATEGORIES.NONE,
      explanation: 'Request parameters are clear, well-formed, and free of known adversarial patterns. Pending final confirmation.',
      intent: 'TRANSFER',
      transaction_allowed: true,
      matched_rule: 'VALID_TRANSFER_VERIFIED'
    };
  }

  // Balance Inquiry
  if (isBalanceIntent) {
    return {
      status: 'APPROVED',
      risk_score: 0,
      threat_category: THREAT_CATEGORIES.NONE,
      explanation: 'Routine read-only mock balance inquiry. No state mutation or financial movement requested.',
      intent: 'BALANCE_INQUIRY',
      transaction_allowed: false, // Balance check cannot execute transfers
      matched_rule: 'BENIGN_BALANCE_INQUIRY'
    };
  }

  // General benign query / unknown intent
  return {
    status: 'APPROVED',
    risk_score: 10,
    threat_category: THREAT_CATEGORIES.NONE,
    explanation: 'No adversarial signatures detected. Request does not trigger financial state changes.',
    intent: 'GENERAL_QUERY',
    transaction_allowed: false,
    matched_rule: 'GENERAL_BENIGN'
  };
}
