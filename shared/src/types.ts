export type CodeStatus =
  | 'unused'
  | 'claimed'
  | 'in_session'
  | 'used'
  | 'expired'
  | 'voided';

export interface Code {
  code: string;
  status: CodeStatus;
  prints_paid_for: number;
  prints_completed: number;
  generated_at: string;
  expires_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  booth_id: string;
  metadata: Record<string, unknown>;
}

export interface WebhookEvent {
  id: string;
  code: string | null;
  event_type: string;
  param1: string | null;
  param2: string | null;
  param3: string | null;
  param4: string | null;
  received_at: string;
  booth_id: string;
  raw: Record<string, unknown>;
}

export interface GenerateCodeRequest {
  prints_paid_for: number;
}

export interface GenerateCodeResponse {
  code: string;
  prints_paid_for: number;
  expires_at: string;
}

export interface ClaimCodeRequest {
  code: string;
  booth_id: string;
}

export type ClaimCodeResponse =
  | {
      ok: true;
      code: string;
      prints_paid_for: number;
      expires_at: string;
    }
  | {
      ok: false;
      reason: 'not_found' | 'expired' | 'already_used';
    };

export interface CodeStatusResponse {
  code: string;
  status: CodeStatus;
  prints_paid_for: number;
  prints_completed: number;
  claimed_at: string | null;
  completed_at: string | null;
}

export interface RecentCodesResponse {
  codes: Array<{
    code: string;
    prints_paid_for: number;
    status: CodeStatus;
    generated_at: string;
    prints_completed: number;
  }>;
}
