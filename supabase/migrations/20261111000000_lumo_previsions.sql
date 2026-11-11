-- Lumo · refonte « prévisions » : on repart d'une base simple.
-- Chaque ligne appartient à un compte Lumo, et seul ce compte peut la lire (règles d'accès en bas).

-- ---------- on retire l'ancienne version (tables vides) ----------
drop function if exists public.k_pair_peek(text);
drop function if exists public.k_pair_join(text);
drop table if exists public.eb_tx, public.eb_accounts, public.eb_wkeys, public.lumo_tickets,
  public.k_vault, public.k_keys, public.k_docs, public.k_usage;
alter table public.eb_sessions drop column if exists owner;
alter table public.eb_states drop column if exists owner;

-- ---------- profil ----------
create table public.profils (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  prenom text,
  coussin numeric not null default 0,          -- somme à toujours garder de côté
  courant_manuel numeric,                      -- dépenses courantes par mois ; vide = calculées d'après la banque
  ignores jsonb not null default '[]',         -- paiements réguliers repérés que l'utilisateur ne veut pas suivre
  pret boolean not null default false,
  cree timestamptz not null default now()
);

-- ---------- comptes (banque ou saisis à la main) ----------
create table public.comptes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nom text not null,
  type text not null default 'courant' check (type in ('courant', 'epargne')),
  solde numeric not null default 0,
  source text not null default 'manuel' check (source in ('manuel', 'banque')),
  banque text,
  session_id text references public.eb_sessions on delete cascade,
  eb_uid text unique,
  inclus boolean not null default true,        -- compté dans la prévision
  maj timestamptz not null default now(),
  cree timestamptz not null default now()
);
create index comptes_user on public.comptes (user_id);
create index comptes_session on public.comptes (session_id);

-- ---------- opérations venues de la banque ----------
create table public.operations (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  compte_id uuid not null references public.comptes on delete cascade,
  date date not null,
  montant numeric not null,
  libelle text
);
create index operations_user_date on public.operations (user_id, date desc);
create index operations_compte on public.operations (compte_id);

-- ---------- revenus et dépenses réguliers ----------
create table public.flux (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nom text not null,
  sens text not null check (sens in ('revenu', 'depense')),
  montant numeric not null check (montant >= 0),
  frequence text not null default 'mois' check (frequence in ('mois', 'trimestre', 'an')),
  mois int check (mois between 1 and 12),      -- pour l'annuel et le trimestriel : mois où ça tombe
  debut text, fin text,                        -- AAAA-MM, vides = toujours
  evolution numeric not null default 0,        -- % par an
  cle text,                                    -- repère dans les opérations bancaires
  actif boolean not null default true,
  cree timestamptz not null default now()
);
create index flux_user on public.flux (user_id);

-- ---------- projets ----------
create table public.projets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('achat', 'investissement', 'changement', 'credit')),
  nom text not null,
  params jsonb not null default '{}',
  actif boolean not null default true,         -- compté dans la prévision
  ordre int not null default 0,
  cree timestamptz not null default now()
);
create index projets_user on public.projets (user_id);

-- ---------- Lumi : plafond de questions par jour ----------
create table public.lumi_usage (
  user_id uuid not null references auth.users on delete cascade,
  jour date not null,
  n int not null default 0,
  primary key (user_id, jour)
);

-- ---------- accès : chacun ne voit que ce qui est à lui ----------
alter table public.profils enable row level security;
alter table public.comptes enable row level security;
alter table public.operations enable row level security;
alter table public.flux enable row level security;
alter table public.projets enable row level security;
alter table public.lumi_usage enable row level security;

create policy "mon profil" on public.profils for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mes comptes" on public.comptes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and source = 'manuel');
create policy "mes comptes banque" on public.comptes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mes opérations" on public.operations for select to authenticated using (user_id = (select auth.uid()));
create policy "mes flux" on public.flux for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mes projets" on public.projets for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- lumi_usage, lumo_conf, eb_states, eb_sync_log : réservés au serveur (aucune règle = aucun accès depuis l'appli)
