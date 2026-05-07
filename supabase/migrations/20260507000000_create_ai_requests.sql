create table if not exists ai_requests (
  id            uuid        default gen_random_uuid() primary key,
  created_at    timestamptz default now(),

  -- Kullanıcı bilgileri
  name          text,
  gender        text,
  birth_date    text,
  birth_year    int,
  current_age   int,
  over_60       boolean,

  -- Doğum haritası sütunları
  year_animal   text,
  year_element  text,
  month_animal  text,
  month_element text,
  day_animal    text,
  day_element   text,

  -- AI yorumları
  dogum_haritasi  text,
  mevcut_donem    text,
  gelecek_donem   text,
  buyuk_kutlama   text
);

-- Sadece service role okuyabilsin (edge function yazar, dış erişim kapalı)
alter table ai_requests enable row level security;
