import crypto from 'node:crypto';
import { evaluateRules } from './rules.js';
import { analyzeWithAI, isAIAvailable, getAIProvider } from './aiAnalyzer.js';
import { mockBank } from '../mockBank.js';
import { logger } from '../utils/logger.js';

// In-memory security audit log
const securityEvents = [];

export function getSecurityEvents() {
  return [...securityEvents].reverse(); // newest first
}

export function clearSecurityEvents() {
  securityEvents.length = 0;
}

/**
 * Main Blue-Team AI Firewall Orchestrator
 * Pipeline:
 * 1. Deterministic Rule & Heuristic Inspection
 * 2. Semantic AI Analysis (if configured) or Explicit Rule-Based Disclosure
 * 3. Fail-Closed Enforcement
 * 4. Authorization Boundary (AI never controls bank execution)
 * 5. Confirmation Token Issuance for 2-step verified transfers
 */
export async function analyzeRequest({ request, amount, recipientId, memo }) {
  const eventId = `SEC-EVT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const timestamp = new Date().toISOString();

  // 1. Stage 1: Deterministic Heuristic & Signature Evaluation
  const ruleResult = evaluateRules({ request, amount, recipientId, memo });

  // If deterministic rules trigger a block, fail fast without calling AI
  if (ruleResult.status === 'BLOCKED') {
    const verdict = {
      eventId,
      timestamp,
      status: 'BLOCKED',
      risk_score: ruleResult.risk_score,
      threat_category: ruleResult.threat_category,
      explanation: ruleResult.explanation,
      intent: ruleResult.intent,
      transaction_allowed: false,
      confirmation_required: false,
      confirmation_token: null,
      mode: isAIAvailable() ? 'HYBRID_AI' : 'RULE_BASED',
      ai_enabled: isAIAvailable(),
      details: {
        stage: 'DETERMINISTIC_RULE_FILTER',
        matched_rule: ruleResult.matched_rule,
        regex_warning: 'Regex and pattern matching filtered this known signature. Note that regex alone cannot detect all novel prompt injections.'
      }
    };

    recordSecurityEvent(verdict, { request, amount, recipientId, memo });
    return verdict;
  }

  // 2. Stage 2: AI Semantic Analysis (if configured)
  const aiConfigured = isAIAvailable();
  let finalStatus = ruleResult.status;
  let finalRisk = ruleResult.risk_score;
  let finalThreat = ruleResult.threat_category;
  let finalExplanation = ruleResult.explanation;
  let finalIntent = ruleResult.intent;
  let evaluationStage = 'RULE_BASED_ONLY';
  let aiDetails = null;

  if (aiConfigured) {
    evaluationStage = 'HYBRID_PIPELINE';
    const aiResult = await analyzeWithAI({ request, amount, recipientId, memo });
    aiDetails = {
      provider: getAIProvider(),
      evaluated: aiResult.evaluated,
      failedClosed: aiResult.failedClosed || false
    };

    if (aiResult.status === 'BLOCKED') {
      finalStatus = 'BLOCKED';
      finalRisk = Math.max(ruleResult.risk_score, aiResult.risk_score || 90);
      finalThreat = aiResult.threat_category;
      finalExplanation = aiResult.explanation;
      finalIntent = aiResult.intent || ruleResult.intent;
    } else {
      // AI also approved
      finalStatus = 'APPROVED';
      finalRisk = Math.max(ruleResult.risk_score, aiResult.risk_score || 0);
      finalThreat = 'NONE';
      finalExplanation = aiResult.explanation || ruleResult.explanation;
      finalIntent = aiResult.intent || ruleResult.intent;
    }
  } else {
    finalExplanation = `${ruleResult.explanation} (Operating in Rule-Based Only Mode: AI API key not configured).`;
  }

  // 3. Stage 3: Core Banking Authorization Invariant (Requirements 8, 10, 11)
  // AI and rules are ADVISORY. Actual transfer eligibility is enforced here in trusted code:
  let transactionAllowed = false;
  let confirmationToken = null;
  let confirmationRequired = false;

  const isTransfer = finalIntent === 'TRANSFER' || ruleResult.intent === 'TRANSFER';

  if (finalStatus === 'APPROVED' && isTransfer) {
    const numAmount = Number.parseFloat(amount);
    const validAmount = !Number.isNaN(numAmount) && numAmount > 0 && numAmount <= 10000;
    const validRecipient = Boolean(recipientId && recipientId.trim().length >= 3);

    if (validAmount && validRecipient) {
      try {
        const tokenData = mockBank.createConfirmationToken({
          amount: numAmount,
          recipientId: recipientId.trim(),
          memo: memo || ''
        });
        transactionAllowed = true;
        confirmationRequired = true;
        confirmationToken = tokenData.token;
      } catch (err) {
        transactionAllowed = false;
        finalStatus = 'BLOCKED';
        finalThreat = 'INPUT_VALIDATION_ERROR';
        finalExplanation = `Failed to generate transaction authorization token: ${err.message}`;
      }
    } else {
      transactionAllowed = false;
      finalStatus = 'BLOCKED';
      finalThreat = 'AMBIGUOUS_REQUEST';
      finalExplanation = 'Transfer cannot be authorized: Missing mandatory amount or recipient ID.';
    }
  } else {
    // Blocked, balance inquiry, or general question never permit transactions
    transactionAllowed = false;
  }

  const verdict = {
    eventId,
    timestamp,
    status: finalStatus,
    risk_score: finalRisk,
    threat_category: finalThreat,
    explanation: finalExplanation,
    intent: finalIntent,
    transaction_allowed: transactionAllowed,
    confirmation_required: confirmationRequired,
    confirmation_token: confirmationToken,
    mode: aiConfigured ? 'HYBRID_AI' : 'RULE_BASED',
    ai_enabled: aiConfigured,
    details: {
      stage: evaluationStage,
      rule_matched: ruleResult.matched_rule,
      ai: aiDetails,
      security_notice: aiConfigured
        ? 'Hybrid Defense: Request inspected by deterministic rule engine and semantic AI threat analyzer.'
        : 'Rule-Based Only Mode: Inspected via deterministic signatures and parameter constraints. To enable semantic AI firewall, provide GEMINI_API_KEY or OPENAI_API_KEY in .env.'
    }
  };

  recordSecurityEvent(verdict, { request, amount, recipientId, memo });
  return verdict;
}

/**
 * Records an immutable security event in memory and logs it
 * @param {Object} verdict
 * @param {Object} inputs
 */
function recordSecurityEvent(verdict, inputs) {
  const event = {
    id: verdict.eventId,
    timestamp: verdict.timestamp,
    status: verdict.status,
    risk_score: verdict.risk_score,
    threat_category: verdict.threat_category,
    intent: verdict.intent,
    explanation: verdict.explanation,
    mode: verdict.mode,
    requestPreview: inputs.request ? inputs.request.slice(0, 80) : '',
    memoPreview: inputs.memo ? inputs.memo.slice(0, 50) : '',
    amount: inputs.amount || null,
    recipientId: inputs.recipientId || null
  };

  securityEvents.push(event);
  logger.security(`Firewall Verdict: ${verdict.status} (${verdict.threat_category}, Risk: ${verdict.risk_score})`, {
    eventId: verdict.eventId,
    intent: verdict.intent
  });

  // Keep latest 100 entries with O(1) bulk trim if list exceeds bounds
  if (securityEvents.length > 100) {
    securityEvents.splice(0, securityEvents.length - 100);
  }
}
