/* =====================================================
   GYMFLOW — CLIENTE SUPABASE (AUTENTICAÇÃO)

   Cria a instância única do SDK oficial (@supabase/supabase-js v2,
   carregado via CDN no index.html) usada pelo Supabase Auth.

   A URL e a Anon Key vêm de supabase-config.js. A Anon Key é pública
   por design (a segurança real vem do RLS). NUNCA coloque aqui a
   service_role key nem o Client Secret do Google: o Client Secret
   fica somente no painel do Supabase (Authentication > Providers).
===================================================== */

// URL de entrada capturada ANTES de criar o cliente: o supabase-js limpa o hash
// ao processar a sessão, e precisamos dele para detectar o link de recuperação
// de senha (type=recovery) e erros devolvidos pelo OAuth/e-mail.
const URL_INICIAL = { search: window.location.search, hash: window.location.hash };

// App instalado (APK)? No navegador comum continua o fluxo padrão.
const APP_NATIVO = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

let supabaseClient = null;

try {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('SDK @supabase/supabase-js não foi carregado (verifique a conexão / CDN).');
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,      // mantém a sessão no localStorage
            autoRefreshToken: true,    // renova o JWT automaticamente
            detectSessionInUrl: !APP_NATIVO,   // na web captura a sessão ao voltar do Google
            flowType: APP_NATIVO ? 'pkce' : 'implicit'  // no APK o retorno é pelo deep link (PKCE)
        }
    });

    console.log('[GymFlow Auth] Cliente Supabase Auth inicializado.');
} catch (err) {
    console.error('[GymFlow Auth] ❌ Falha ao inicializar o cliente Supabase:', err.message);
}
