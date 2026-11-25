-- Ejecutar únicamente en XV_CAMILA (bwwmrtxuninbqvoyuruo).
-- Crear antes camila@xv-camila.example mediante Supabase Auth con Auto Confirm.
-- Este script no contiene ni cambia contraseñas.
do $$
declare cuenta uuid;
begin
  select id into cuenta from auth.users
  where email = 'camila@xv-camila.example'
    and email_confirmed_at is not null and deleted_at is null;
  if cuenta is null then
    raise exception 'Primero crea y confirma la cuenta técnica en Authentication > Users.';
  end if;
  insert into camila_xv.organizadoras(usuario) values(cuenta)
  on conflict(usuario) do nothing;
end;
$$;
