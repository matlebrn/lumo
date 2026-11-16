-- Lumo · classement des opérations : quand l'utilisateur range une opération dans une catégorie,
-- Lumo retient la règle (début du libellé + sens) et l'applique à toutes les opérations du même genre.
create table public.classements (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cle text not null,
  categorie text not null check (char_length(categorie) <= 30),
  maj timestamptz not null default now(),
  primary key (user_id, cle)
);
alter table public.classements enable row level security;
create policy "mes classements" on public.classements for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
