// ---------------------------------------------------------------------------
// Extraction Contract Types
// ---------------------------------------------------------------------------

/** Per-field value-shape fingerprint stored in contracts */
export interface FieldFingerprint {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  /** String fingerprint */
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  /** Number fingerprint */
  min?: number;
  max?: number;
  isInteger?: boolean;
  /** Array fingerprint */
  minItems?: number;
  maxItems?: number;
  itemType?: string;
  /** Whether the field can be null/undefined */
  nullable: boolean;
  /** Sample values from past extractions */
  sampleValues: unknown[];
}

/** How a field was located on the page (CSS selectors, text anchors) */
export interface SemanticAnchor {
  field: string;
  anchors: string[];
  selectors: string[];
}

/** A single provenance snapshot — stored in a history array */
export interface ContractProvenance {
  timestamp: string;
  contentHash: string;
  sourceUrl: string;
  sourceSnippets: Record<string, string>;
  fields: Record<string, unknown>;
  healed: boolean;
}

/** The schema definition stored on a contract */
export interface ContractSchema {
  fields: Record<
    string,
    {
      type: string;
      description?: string;
      nullable?: boolean;
    }
  >;
}

/** Full contract record shape (matches extraction_contracts DB row) */
export interface ExtractionContract {
  id: string;
  userId: string;
  url: string;
  name: string | null;
  schema: ContractSchema;
  fingerprint: Record<string, FieldFingerprint>;
  semanticAnchors: SemanticAnchor[];
  provenance: ContractProvenance[];
  lastHealedAt: string | null;
  lastRunAt: string | null;
  runCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Single extraction run record */
export interface ExtractionRun {
  id: string;
  contractId: string;
  status: 'ok' | 'drifted' | 'healed' | 'failed';
  contentHash: string;
  values: Record<string, unknown> | null;
  confidence: Record<string, number> | null;
  validationResult: Record<string, { valid: boolean; reason?: string }> | null;
  diffFromContract: Record<string, { before: unknown; after: unknown }> | null;
  healedFields: string[];
  error: string | null;
  extractedAt: string;
}

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

export type CaptureContractParams = {
  userId: string;
  url: string;
  schema: ContractSchema;
  values: Record<string, unknown>;
  sourceSnippets: Record<string, string>;
  confidence: Record<string, number>;
  contentHash: string;
  semanticAnchors?: SemanticAnchor[];
};

export type ValidateContractResult = {
  status: 'ok' | 'drifted';
  runId: string;
  fields: Record<string, { valid: boolean; reason?: string }>;
  needsHealing: string[];
};

export type HealContractResult = {
  status: 'healed' | 'needs_review';
  runId: string;
  healedFields: string[];
  diff: Record<string, { before: unknown; after: unknown }>;
  newValues: Record<string, unknown>;
};
