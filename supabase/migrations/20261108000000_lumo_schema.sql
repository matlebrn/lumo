-- Lumo · base de données propre à Lumo (aucun lien avec une autre appli)
-- Tout ce qui est personnel est chiffré sur le téléphone avant d'arriver ici.
create extension if not exists pgcrypto with schema extensions;

-- ---------- coffre chiffré de l'appli ----------
create table public.k_vault (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  slot text not null,
  data text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);
create table public.k_keys (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  rsa_pub jsonb,
  ecdh_pub jsonb,
  updated_at timestamptz not null default now()
);
create table public.k_docs (
  path text primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  members uuid[] not null default '{}',
  data text,
  updated_at timestamptz not null default now()
);
create table public.k_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  n int not null default 0,
  tok int not null default 0,
  primary key (user_id, day)
);

-- ---------- banque (Enable Banking) ----------
create table public.eb_banks (
  name text not null,
  country text not null,
  max_days int,
  logo text,
  psu_headers jsonb,
  updated_at timestamptz default now(),
  primary key (name, country)
);
create table public.eb_states (
  state text primary key,
  bank text, country text, owner text,
  user_id uuid references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create table public.eb_sessions (
  session_id text primary key,
  user_id uuid references auth.users on delete cascade,
  owner text,
  bank text, country text,
  valid_until timestamptz,
  status text,
  accounts jsonb default '[]',
  calls jsonb default '[]',
  last_sync timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create table public.eb_accounts (
  uid text primary key,
  session_id text references public.eb_sessions on delete cascade,
  bank text, name text, iban text, currency text, product text, cash_type text,
  balance numeric, balance_type text, balance_at timestamptz,
  enc text, kid text,
  updated_at timestamptz default now()
);
create table public.eb_tx (
  id text primary key,
  account_uid text references public.eb_accounts on delete cascade,
  bank text, date date, amount numeric, label text, status text, raw jsonb,
  enc text, kid text
);
create index eb_tx_account on public.eb_tx (account_uid);
create table public.eb_wkeys (
  id text primary key,
  user_id uuid references auth.users on delete cascade,
  wrapped text not null
);
create table public.eb_sync_log (
  id bigint generated always as identity primary key,
  ok boolean, msg text,
  at timestamptz not null default now()
);

-- ---------- réglages serveur ----------
create table public.lumo_conf (id int primary key, token text not null);
insert into public.lumo_conf values (1, encode(extensions.gen_random_bytes(32), 'hex'));
create table public.lumo_tickets (
  t text primary key,
  kind text not null,
  exp timestamptz not null,
  used boolean not null default false,
  user_id uuid references auth.users on delete cascade,
  owner text
);

create index eb_sessions_user on public.eb_sessions (user_id);
create index eb_accounts_session on public.eb_accounts (session_id);
create index eb_wkeys_user on public.eb_wkeys (user_id);
create index eb_states_user on public.eb_states (user_id);
create index lumo_tickets_user on public.lumo_tickets (user_id);
create index k_docs_owner on public.k_docs (owner);

-- ---------- accès : chacun ne voit que ce qui est à lui ----------
alter table public.k_vault enable row level security;
alter table public.k_keys enable row level security;
alter table public.k_docs enable row level security;
alter table public.k_usage enable row level security;
alter table public.eb_banks enable row level security;
alter table public.eb_states enable row level security;
alter table public.eb_sessions enable row level security;
alter table public.eb_accounts enable row level security;
alter table public.eb_tx enable row level security;
alter table public.eb_wkeys enable row level security;
alter table public.eb_sync_log enable row level security;
alter table public.lumo_conf enable row level security;
alter table public.lumo_tickets enable row level security;

create policy "mon coffre" on public.k_vault for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mes clés" on public.k_keys for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mes documents" on public.k_docs for all to authenticated using ((select auth.uid()) = any (members) or owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "liste des banques" on public.eb_banks for select to authenticated using (true);
create policy "mes banques" on public.eb_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy "mes comptes" on public.eb_accounts for select to authenticated using (session_id in (select session_id from public.eb_sessions where user_id = (select auth.uid())));
create policy "mes opérations" on public.eb_tx for select to authenticated using (account_uid in (select a.uid from public.eb_accounts a join public.eb_sessions s on s.session_id = a.session_id where s.user_id = (select auth.uid())));
create policy "mes clés banque" on public.eb_wkeys for select to authenticated using (user_id = (select auth.uid()));
-- lumo_conf, lumo_tickets, eb_states, eb_sync_log, k_usage : réservés au serveur (aucune règle = aucun accès depuis l'appli)

-- ---------- ancienne liaison à deux : désactivée dans Lumo ----------
create function public.k_pair_peek(p text) returns text language sql stable security invoker set search_path = '' as $$ select null::text $$;
create function public.k_pair_join(p text) returns boolean language sql stable security invoker set search_path = '' as $$ select false $$;
