// ◊·κ=1 · fall-euaiact SDK · TypeScript types

export type Tier = 'prohibited' | 'high' | 'limited' | 'minimal';

export interface TriggerHit {
  note: string;
  article: string;
}

export interface ClassifyResult {
  tier: Tier;
  label: string;
  triggers: TriggerHit[];
  articles: string[];
  /** 0-100 · how many trigger rules matched */
  confidence: number;
}

export interface DeepClassifyOpts {
  provider: 'anthropic' | 'openai' | 'google';
  apiKey: string;
  /** optional model override · defaults to claude-3-5-sonnet / gpt-4o-mini / gemini-1.5-flash */
  model?: string;
}

export interface DeepClassifyResult {
  tier: Tier;
  confidence: number;
  articles: string[];
  reasoning: string;
  key_risks: string[];
  next_steps: string[];
}

export interface Article {
  id: string;
  title: string;
  enforceFrom: string;
  tags: string[];
  summary: string;
  penalty?: string;
}

export interface AnnexIIIEntry {
  num: number;
  title: string;
}

export interface PenaltyEntry {
  breach: string;
  max: string;
}

export interface DeadlineEntry {
  date: string;
  what: string;
}

export interface AuditEvent {
  type: string;
  input?: string;
  output?: string;
  operator?: string;
  metadata?: object;
}

export interface AuditEntry {
  ts: string;
  event_type: string;
  input_summary: string | null;
  output_summary: string | null;
  operator_id: string | null;
  metadata: object | null;
  prev_hash: string;
  hash: string;
}

export interface AuditShim {
  log(event: AuditEvent): Promise<AuditEntry>;
  exportAll(): Promise<AuditEntry[]>;
  verifyChain(): Promise<{ valid: boolean; broken_at?: number; total: number }>;
  clear(): Promise<void>;
}

export interface AuditOpts {
  dbName?: string;
  retention_days?: number;
  sink?: 'indexeddb' | 'memory';
}

export interface DocField {
  id: string;
  q: string;
  placeholder: string;
  art: string;
}

export interface DocGenOpts {
  date?: string;
  draftWarning?: boolean;
}

export declare const TIERS: {
  PROHIBITED: 'prohibited';
  HIGH: 'high';
  LIMITED: 'limited';
  MINIMAL: 'minimal';
};

export declare const DEEP_PROMPT: string;
export declare const ARTICLES: Article[];
export declare const ANNEX_III_CATEGORIES: AnnexIIIEntry[];
export declare const PENALTIES: PenaltyEntry[];
export declare const DEADLINES: DeadlineEntry[];
export declare const DOC_FIELDS: DocField[];
export declare const SDK_VERSION: string;
export declare const SPEC_VERSION: string;

export declare function classify(description: string): ClassifyResult;
export declare function deepClassify(description: string, opts: DeepClassifyOpts): Promise<DeepClassifyResult>;
export declare function searchArticles(query: string): Article[];
export declare function getArticle(id: string): Article | undefined;
export declare function articlesForTier(tier: Tier): Article[];
export declare function createAuditShim(opts?: AuditOpts): AuditShim;
export declare function generateAnnexIV(values: Record<string, string>, opts?: DocGenOpts): string;
export declare function getDocFields(): DocField[];
export declare function validateValues(values: Record<string, string>): string[];
