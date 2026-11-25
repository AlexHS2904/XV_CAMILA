-- Ejecutar únicamente en XV_CAMILA (bwwmrtxuninbqvoyuruo).
-- Crear antes camila@admin.com mediante Supabase Auth con Auto Confirm.
-- Este script no contiene ni cambia contraseñas.
do $$
declare cuenta uuid;
begin
  select id into cuenta from auth.users
  where email = 'camila@admin.com'
    and email_confirmed_at is not null and deleted_at is null;
  if cuenta is null then
    raise exception 'Primero crea y confirma la cuenta técnica en Authentication > Users.';
  end if;
  -- El acceso definitivo pertenece solo a esta cuenta; no cambia usuarios ni contraseñas.
  delete from camila_xv.organizadoras where usuario <> cuenta;
  insert into camila_xv.organizadoras(usuario) values(cuenta)
  on conflict(usuario) do nothing;
end;
$$;
