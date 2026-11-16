-- Lumo grand public · préférences de la personne et droits (gratuit ou Lumo Plus).

-- ce que la personne a dit à l'accueil : Lumo s'adapte à ces réponses
alter table public.profils
  add column if not exists situation text check (situation in ('etudiant', 'salarie', 'famille', 'independant', 'retraite')),
  add column if not exists objectif text check (objectif in ('finDeMois', 'projet', 'grossir', 'sortir')),
  add column if not exists style_lumi text not null default 'coach' check (style_lumi in ('coach', 'expert', 'direct', 'ludique'));

-- le plan de chaque personne. Lisible par elle, modifiable seulement par le serveur (paiements, plus tard).
create table if not exists public.droits (
  user_id uuid primary key references auth.users on delete cascade,
  plan text not null default 'gratuit' check (plan in ('gratuit', 'plus')),
  source text check (source in ('app_store', 'google_play', 'web', 'offert')),
  valide_jusqu timestamptz,
  maj timestamptz not null default now()
);
alter table public.droits enable row level security;
create policy "mes droits, en lecture" on public.droits for select to authenticated using (user_id = (select auth.uid()));
-- aucune règle d'écriture : l'appli ne peut ni créer ni changer un plan

-- le plan en vigueur, pour le serveur (fonctions)
create or replace function public.plan_de(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select d.plan from public.droits d where d.user_id = uid and (d.valide_jusqu is null or d.valide_jusqu > now())), 'gratuit');
$$;
revoke all on function public.plan_de(uuid) from public, anon, authenticated;
grant execute on function public.plan_de(uuid) to service_role;
