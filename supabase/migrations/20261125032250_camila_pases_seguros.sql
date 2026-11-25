begin;

create schema if not exists camila_xv;
revoke all on schema camila_xv from public, anon, authenticated;
grant usage on schema camila_xv to anon, authenticated;

create table if not exists camila_xv.organizadoras (
  usuario uuid primary key references auth.users(id) on delete cascade
);

create table if not exists camila_xv.pases (
  folio text primary key check (folio ~ '^[A-Z0-9][A-Z0-9._-]{0,49}$'),
  token uuid not null unique default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 160),
  boletos integer not null check (boletos between 1 and 15),
  mesa text not null default '' check (length(mesa) <= 80),
  estado text not null default 'pendiente' check (estado in ('pendiente','asiste','no_asiste')),
  confirmados integer not null default 0 check (confirmados between 0 and boletos),
  asistentes text[] not null default '{}',
  telefono text not null default '',
  cancion text not null default '',
  mensaje text not null default '',
  check ((estado = 'asiste') = (confirmados > 0)),
  check (cardinality(asistentes) = confirmados)
);

alter table camila_xv.organizadoras enable row level security;
alter table camila_xv.pases enable row level security;
revoke all on camila_xv.organizadoras, camila_xv.pases from public, anon, authenticated;

create or replace function camila_xv.exigir_organizadora()
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists (select from camila_xv.organizadoras where usuario = (select auth.uid()))
    or not exists (
      select from auth.sessions
      where id = nullif(auth.jwt()->>'session_id', '')::uuid
        and user_id = (select auth.uid())
        and (not_after is null or not_after > now())
    ) then
    raise exception using errcode = '42501', message = 'Esta cuenta no administra la invitación.';
  end if;
end;
$$;

create or replace function camila_xv.listar()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform camila_xv.exigir_organizadora();
  return (select coalesce(jsonb_agg(to_jsonb(p) order by p.nombre, p.folio), '[]'::jsonb)
          from camila_xv.pases p);
end;
$$;

create or replace function camila_xv.importar(filas jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  fila jsonb;
  clave text;
  cantidad integer;
  anterior camila_xv.pases;
  salida jsonb;
begin
  perform camila_xv.exigir_organizadora();
  if jsonb_typeof(filas) is distinct from 'array' then
    raise exception 'Selecciona una lista de familias.';
  end if;
  if jsonb_array_length(filas) not between 1 and 2000 then
    raise exception 'Importa entre 1 y 2000 familias por archivo.';
  end if;
  if exists (select from jsonb_array_elements(filas) as f group by f->>'folio' having count(*) > 1) then
    raise exception 'Hay folios repetidos en el archivo. Asigna uno distinto a cada familia.';
  end if;
  -- Las importaciones simultáneas comparten el mismo orden de escritura.
  perform pg_advisory_xact_lock(49201, 20270220);
  for fila in select value from jsonb_array_elements(filas) order by value->>'folio' loop
    clave := fila->>'folio';
    if clave is null or clave !~ '^[A-Z0-9][A-Z0-9._-]{0,49}$'
      or coalesce(length(btrim(fila->>'nombre')), 0) not between 1 and 160
      or coalesce(fila->>'boletos', '') !~ '^[0-9]{1,2}$'
      or length(coalesce(fila->>'mesa','')) > 80 then
      raise exception 'Revisa el nombre, folio, boletos o mesa de la fila %.', fila->>'fila';
    end if;
    cantidad := (fila->>'boletos')::integer;
    if cantidad not between 1 and 15 then
      raise exception 'Fila %: el cupo debe estar entre 1 y 15.', fila->>'fila';
    end if;

    select * into anterior from camila_xv.pases where folio = clave for update;
    if nullif(fila->>'token','') is not null and
       (anterior.token is null or anterior.token::text <> lower(fila->>'token')) then
      raise exception 'Fila %: el enlace no corresponde al folio %.', fila->>'fila', clave;
    end if;
    if anterior.confirmados > cantidad then
      raise exception 'Fila %: % ya confirmó % lugares.', fila->>'fila', anterior.nombre, anterior.confirmados;
    end if;
    insert into camila_xv.pases as p (folio, nombre, boletos, mesa)
    values (clave, btrim(fila->>'nombre'), cantidad, btrim(coalesce(fila->>'mesa', anterior.mesa, '')))
    on conflict (folio) do update
      set nombre = excluded.nombre, boletos = excluded.boletos, mesa = excluded.mesa;
  end loop;
  select jsonb_agg(jsonb_build_object('folio', p.folio, 'token', p.token) order by f.orden)
  into salida from jsonb_array_elements(filas) with ordinality as f(dato, orden)
  join camila_xv.pases p on p.folio = f.dato->>'folio';
  return salida;
end;
$$;

create or replace function camila_xv.ver(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) - 'token' - 'folio' from camila_xv.pases p where p.token = p_token;
$$;

create or replace function camila_xv.eliminar(p_folio text, p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform camila_xv.exigir_organizadora();
  -- El token evita borrar un pase recreado con el mismo folio desde otra sesión.
  delete from camila_xv.pases where folio = p_folio and token = p_token;
  if not found then raise exception 'El pase cambió o ya fue eliminado. Actualiza la lista.'; end if;
  return true;
end;
$$;

create or replace function camila_xv.responder(p_token uuid, respuesta jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pase camila_xv.pases;
  nombres text[];
  cuantos integer;
  nuevo_estado text := coalesce(respuesta->>'estado', '');
begin
  select * into pase from camila_xv.pases where token = p_token for update;
  if not found then raise exception 'Este enlace de invitación no es válido.'; end if;
  if nuevo_estado not in ('asiste','no_asiste')
     or jsonb_typeof(respuesta->'asistentes') is distinct from 'array' then
    raise exception 'Revisa tu respuesta de asistencia.';
  end if;
  cuantos := jsonb_array_length(respuesta->'asistentes');
  if (nuevo_estado = 'asiste' and cuantos not between 1 and pase.boletos)
     or (nuevo_estado = 'no_asiste' and cuantos <> 0) then
    raise exception 'La cantidad de asistentes supera el cupo o no corresponde a la respuesta.';
  end if;
  if exists (select from jsonb_array_elements(respuesta->'asistentes') as n
             where jsonb_typeof(n) <> 'string' or length(btrim(n #>> '{}')) not between 1 and 160) then
    raise exception 'Escribe el nombre de cada asistente.';
  end if;
  if length(coalesce(respuesta->>'telefono','')) > 40 or length(coalesce(respuesta->>'cancion','')) > 200
     or length(coalesce(respuesta->>'mensaje','')) > 1000 then
    raise exception 'Revisa la longitud del teléfono, canción o mensaje.';
  end if;
  nombres := array(select btrim(v) from jsonb_array_elements_text(respuesta->'asistentes') with ordinality as n(v, i) order by i);
  update camila_xv.pases as p set estado = nuevo_estado, confirmados = cuantos, asistentes = nombres,
    telefono = btrim(coalesce(respuesta->>'telefono','')), cancion = btrim(coalesce(respuesta->>'cancion','')),
    mensaje = btrim(coalesce(respuesta->>'mensaje',''))
  where p.token = p_token returning p.* into pase;
  return to_jsonb(pase) - 'token' - 'folio';
end;
$$;

create or replace function public.camila_xv_listar()
returns jsonb language sql stable security invoker set search_path = '' as $$ select camila_xv.listar(); $$;
create or replace function public.camila_xv_importar(filas jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select camila_xv.importar(filas); $$;
create or replace function public.camila_xv_ver(p_token uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$ select camila_xv.ver(p_token); $$;
create or replace function public.camila_xv_responder(p_token uuid, respuesta jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select camila_xv.responder(p_token, respuesta); $$;
create or replace function public.camila_xv_eliminar(p_folio text, p_token uuid)
returns boolean language sql security invoker set search_path = '' as $$ select camila_xv.eliminar(p_folio, p_token); $$;

revoke all on all functions in schema camila_xv from public, anon, authenticated;
revoke all on function public.camila_xv_listar(), public.camila_xv_importar(jsonb),
  public.camila_xv_ver(uuid), public.camila_xv_responder(uuid,jsonb), public.camila_xv_eliminar(text,uuid) from public, anon, authenticated;
grant execute on function camila_xv.listar(), camila_xv.importar(jsonb),
  public.camila_xv_listar(), public.camila_xv_importar(jsonb) to authenticated;
grant execute on function camila_xv.eliminar(text,uuid), public.camila_xv_eliminar(text,uuid) to authenticated;
grant execute on function camila_xv.ver(uuid), camila_xv.responder(uuid,jsonb),
  public.camila_xv_ver(uuid), public.camila_xv_responder(uuid,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
