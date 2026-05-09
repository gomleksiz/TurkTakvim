-- Add unique code column to fake_future for URL-based sharing
alter table fake_future add column if not exists code varchar(12) unique;
