-- Les comptes peuvent aussi être des placements (assurance vie, PEA, PER…)
alter table public.comptes drop constraint comptes_type_check;
alter table public.comptes add constraint comptes_type_check check (type in ('courant', 'epargne', 'placement'));
