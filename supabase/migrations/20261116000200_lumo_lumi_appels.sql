-- Lumi qui fouille : une question peut demander plusieurs échanges avec le modèle (une recherche par échange).
-- On compte les questions (n) et les échanges (appels), pour plafonner les deux.
alter table public.lumi_usage add column if not exists appels int not null default 0;
