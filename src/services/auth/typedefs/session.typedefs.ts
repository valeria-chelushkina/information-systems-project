export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  user_agent: string | null;
}

export interface NewSession {
  id: string;
  userId: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  userAgent: string | null;
}
