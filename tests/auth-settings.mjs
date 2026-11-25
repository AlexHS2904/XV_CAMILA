import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sandbox = {window:{}};
vm.runInNewContext(readFileSync('assets/js/config.js','utf8'),sandbox);
const {supabaseUrl,publishableKey} = sandbox.window.CAMILA_CONFIG;
assert.equal(supabaseUrl,'https://bwwmrtxuninbqvoyuruo.supabase.co');
const headers = {apikey:publishableKey,'Content-Type':'application/json'};
const settings = await fetch(supabaseUrl+'/auth/v1/settings',{headers});
assert.ok(settings.ok);
const configuration = await settings.json();
console.log(JSON.stringify({disable_signup:configuration.disable_signup,
  anonymous_users_enabled:configuration.external?.anonymous_users,
  email_enabled:configuration.external?.email}));
// No intentar registrar ni enviar correo si el registro sigue habilitado.
assert.equal(configuration.disable_signup,true,'Desactiva Allow new users to sign up en el dashboard de XV_CAMILA.');
assert.equal(configuration.external?.anonymous_users,false);
assert.equal(configuration.external?.email,true,'Email debe seguir habilitado para el login existente.');
const response = await fetch(supabaseUrl+'/auth/v1/signup',{
  method:'POST',headers,
  body:JSON.stringify({email:'qa-signup-'+Date.now()+'@admin.com',password:randomBytes(30).toString('base64url')})
});
const result = await response.json();
assert.equal(response.ok,false);
assert.equal(result.error_code,'signup_disabled');
console.log('PASS Registro público rechazado por Supabase Auth; Email habilitado y acceso anónimo deshabilitado.');
