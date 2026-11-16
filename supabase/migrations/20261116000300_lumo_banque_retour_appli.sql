-- Connexion bancaire depuis l'appli iPhone / Android : après l'accord à la banque, on revient dans l'appli
-- (lumo://banque) au lieu du site. Seules ces deux destinations existent : aucune redirection libre.
alter table public.eb_states add column if not exists retour text not null default 'web' check (retour in ('web', 'appli'));
