-- PoC DEC-002: modelo minimo de identidade no banco CENTRAL (nunca no banco do tenant).
CREATE TABLE organizations (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,          -- argon2id (PHC string, salt embutido)
  totp_secret_enc bytea                 -- seed TOTP cifrada (AES-256-GCM, chave fora do banco)
);
CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users(id),
  org_id  uuid NOT NULL REFERENCES organizations(id),
  role text NOT NULL,
  PRIMARY KEY (user_id, org_id)
);
CREATE TABLE sessions (
  token_hash bytea PRIMARY KEY,         -- sha256 do token opaco; o token em claro nunca e gravado
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
