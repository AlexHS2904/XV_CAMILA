import {writeFileSync} from 'node:fs';

const {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, INVITATION_URL = ''} = process.env;
if (SUPABASE_URL !== 'https://bwwmrtxuninbqvoyuruo.supabase.co') {
  throw new Error('Este repositorio solo configura el proyecto XV_CAMILA.');
}
if (!SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
  throw new Error('Usa una clave publicable; no se aceptan claves secretas.');
}
if (INVITATION_URL && new URL(INVITATION_URL).protocol !== 'https:') {
  throw new Error('La dirección publicada de la invitación debe usar HTTPS.');
}
writeFileSync('assets/js/config.js', 'window.CAMILA_CONFIG = ' + JSON.stringify({
  supabaseUrl: SUPABASE_URL,
  publishableKey: SUPABASE_PUBLISHABLE_KEY,
  invitationUrl: INVITATION_URL
}, null, 2) + ';\n');
