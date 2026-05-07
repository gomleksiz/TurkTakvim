alter table ai_requests
  add column if not exists onemli_anlar jsonb;
