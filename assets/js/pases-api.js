(() => {
  'use strict';
  let connection;
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  function client() {
    if (connection) return connection;
    const {supabaseUrl, publishableKey} = window.CAMILA_CONFIG;
    if (!supabaseUrl || !publishableKey) {
      throw new Error('Falta conectar el proyecto de Supabase en assets/js/config.js.');
    }
    let storage;
    try {storage = window.sessionStorage;} catch {}
    connection = window.supabase.createClient(supabaseUrl, publishableKey, {
      auth: {storage, persistSession:Boolean(storage), storageKey:'camila-xv-sesion', detectSessionInUrl:false}
    });
    return connection;
  }
  async function rpc(action, args = {}) {
    const {data, error} = await client().rpc('camila_xv_' + action, args);
    if (error) throw new Error(error.message || 'No se pudo conectar. Inténtalo de nuevo.');
    return data;
  }
  function link(token) {
    if (!uuid.test(token)) throw new Error('El servidor devolvió un pase sin enlace válido.');
    const url = new URL(window.CAMILA_CONFIG.invitationUrl || './', window.location.href);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Abre el panel desde el sitio publicado o un servidor local.');
    url.search = '';
    url.hash = '';
    url.searchParams.set('invitado', token);
    return url.href;
  }
  window.CamilaPases = {client, rpc, link, uuid};
})();
