-- Lumo · tirer le maximum de la banque (toujours en lecture seule).
-- Détail de chaque opération, opérations en cours, vrai disponible, IBAN des comptes, jour de paie,
-- et des mises à jour automatiques mieux placées.

alter table public.operations
  add column if not exists contrepartie text,             -- vrai nom du commerçant ou du bénéficiaire
  add column if not exists contrepartie_iban text,        -- son IBAN, quand la banque le donne
  add column if not exists mcc text,                      -- code d'activité du commerçant (carte)
  add column if not exists date_valeur date,
  add column if not exists code_banque text,              -- type d'opération selon la banque
  add column if not exists statut text not null default 'BOOK' check (statut in ('BOOK', 'PDNG'));
create index if not exists operations_contrepartie_iban on public.operations (user_id, contrepartie_iban) where contrepartie_iban is not null;

alter table public.comptes
  add column if not exists iban text,
  add column if not exists solde_dispo numeric,           -- disponible annoncé par la banque
  add column if not exists decouvert numeric,             -- découvert autorisé, quand la banque le donne
  add column if not exists devise text;

-- jour habituel de la paie (calculé par l'appli) : le serveur actualise plus souvent ces jours-là
alter table public.profils add column if not exists jour_paie int check (jour_paie between 1 and 31);

-- toutes les heures, le serveur choisit lui-même s'il est utile d'actualiser chaque banque
-- (4 accès automatiques par 24 h au plus, placés aux bons moments)
do $$ begin
  perform cron.unschedule(j) from unnest(array['lumo-synchro-6', 'lumo-synchro-11', 'lumo-synchro-16', 'lumo-synchro-20']) as j
    where exists (select 1 from cron.job where jobname = j);
end $$;
select cron.schedule('lumo-synchro', '7 * * * *', $cmd$
  select net.http_post(
    url := 'https://yyxudhwlduznoteuddmp.supabase.co/functions/v1/bank/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-lumo', (select token from public.lumo_conf where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$cmd$);
