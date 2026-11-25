begin;
-- Las respuestas anteriores conservan NULL: no se inventa una fecha histórica.
alter table camila_xv.pases add column if not exists confirmado_en timestamptz;

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
    mensaje = btrim(coalesce(respuesta->>'mensaje','')), confirmado_en = clock_timestamp()
  where p.token = p_token returning p.* into pase;
  return to_jsonb(pase) - 'token' - 'folio';
end;
$$;

-- CREATE OR REPLACE conserva los permisos de la función existente.
notify pgrst, 'reload schema';
commit;
