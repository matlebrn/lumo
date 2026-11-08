-- Lumo : actualisation bancaire automatique 4 fois par jour (limite DSP2 : 4 accès sans l'utilisateur par 24 h).
-- Heures de Paris : ~7 h, 12 h, 17 h, 21 h (cron en UTC, heure d'hiver).
-- Le jeton d'appel est lu dans la base au moment de l'appel : il n'apparaît jamais ici.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('lumo-synchro-' || h, '5 ' || h || ' * * *', $cmd$
  select net.http_post(
    url := 'https://yyxudhwlduznoteuddmp.supabase.co/functions/v1/bank/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-lumo', (select token from public.lumo_conf where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$cmd$) from unnest(array['6', '11', '16', '20']) as h;
