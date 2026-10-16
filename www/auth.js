/* =====================================================
   GYMFLOW — AUTENTICAÇÃO (SUPABASE AUTH)

   Formas de acesso:
   • E-mail e senha ......... signInWithPassword()
   • Criar conta ............ signUp()
   • Google (OAuth 2.0) ..... signInWithOAuth({ provider: 'google' })
   • Esqueci minha senha .... resetPasswordForEmail() + updateUser()

   Estado da sessão:
   • getSession() recupera a sessão ao abrir o app
   • onAuthStateChange() reage a login, logout e renovação do token
   • signOut() encerra a sessão
===================================================== */

let usuarioAtual = null;
let modoAuth = 'entrar';        // 'entrar' | 'criar' | 'redefinir'
let emRecuperacao = false;      // true enquanto o usuário define a nova senha

const MIN_SENHA = 6;

const TEXTOS_MODO = {
    entrar:    { titulo: 'Entrar na sua conta', sub: 'Use seu e-mail e senha ou continue com o Google.', botao: 'Entrar',            ocupado: 'Entrando...' },
    criar:     { titulo: 'Criar sua conta',      sub: 'Comece a registrar seus treinos.',                 botao: 'Criar conta',        ocupado: 'Criando conta...' },
    redefinir: { titulo: 'Definir nova senha',   sub: 'Escolha uma senha nova para sua conta.',           botao: 'Salvar nova senha',  ocupado: 'Salvando...' }
};

// Quais elementos aparecem em cada modo
const VISIVEL_EM = {
    abasModo:       ['entrar', 'criar'],
    grupoEmail:     ['entrar', 'criar'],
    linkEsqueci:    ['entrar'],
    dicaSenha:      ['criar', 'redefinir'],
    grupoConfirmar: ['criar', 'redefinir'],
    blocoGoogle:    ['entrar', 'criar']
};

const CLASSE_ABA_ATIVA = 'flex-1 py-2 rounded-lg text-sm font-bold bg-gym-500 text-dark-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300';
const CLASSE_ABA_INATIVA = 'flex-1 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300';

/* ─── Helpers de UI ─────────────────────────────────── */

function _authEl(id) {
    return document.getElementById(id);
}

function _valor(id) {
    const el = _authEl(id);
    return el ? el.value : '';
}

function mostrarErroLogin(mensagem) {
    const erro = _authEl('loginErro');
    const aviso = _authEl('loginAviso');
    if (aviso) { aviso.classList.add('hidden'); aviso.textContent = ''; }
    if (!erro) return;
    erro.textContent = mensagem || ''; // textContent: nunca interpreta HTML
    erro.classList.toggle('hidden', !mensagem);
}

function mostrarAvisoLogin(mensagem) {
    const erro = _authEl('loginErro');
    const aviso = _authEl('loginAviso');
    if (erro) { erro.classList.add('hidden'); erro.textContent = ''; }
    if (!aviso) return;
    aviso.textContent = mensagem || '';
    aviso.classList.toggle('hidden', !mensagem);
}

function _marcarInvalido(id, invalido) {
    const el = _authEl(id);
    if (!el) return;
    if (invalido) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
}

function _limparInvalidos() {
    ['authEmail', 'authSenha', 'authConfirmar'].forEach(id => _marcarInvalido(id, false));
}

function _limparSenhas() {
    ['authSenha', 'authConfirmar'].forEach(id => {
        const el = _authEl(id);
        if (el) el.value = '';
    });
}

/**
 * Trava/destrava o formulário inteiro e ajusta os rótulos dos botões.
 * @param {boolean} ocupado
 * @param {{google?: string, submit?: string}} textos rótulo do botão que está trabalhando
 */
function setOcupado(ocupado, textos = {}) {
    const fieldset = _authEl('loginFieldset');
    if (fieldset) {
        fieldset.disabled = ocupado;
        fieldset.classList.toggle('opacity-60', ocupado);
    }

    const gTexto = _authEl('btnLoginGoogleTexto');
    const gIcone = _authEl('btnLoginGoogleIcone');
    const googleOcupado = ocupado && !!textos.google;
    if (gTexto) gTexto.textContent = googleOcupado ? textos.google : 'Entrar com Google';
    if (gIcone) gIcone.className = googleOcupado ? 'fa-solid fa-spinner fa-spin' : 'fa-brands fa-google';

    const sTexto = _authEl('btnAuthSubmitTexto');
    const sIcone = _authEl('btnAuthSubmitIcone');
    const submitOcupado = ocupado && !!textos.submit;
    if (sTexto) sTexto.textContent = submitOcupado ? textos.submit : TEXTOS_MODO[modoAuth].botao;
    if (sIcone) sIcone.className = submitOcupado ? 'fa-solid fa-spinner fa-spin' : 'hidden';
}

/** Exibe a tela de login (sem sessão) ou libera o app (com sessão). */
function alternarTelaLogin(logado) {
    const overlay = _authEl('telaLogin');
    if (overlay) overlay.classList.toggle('hidden', logado);
    document.body.classList.toggle('overflow-hidden', !logado);
}

/** Troca entre Entrar, Criar conta e Definir nova senha. */
function alternarModoAuth(modo) {
    if (!TEXTOS_MODO[modo]) return;
    modoAuth = modo;

    _limparInvalidos();
    mostrarErroLogin('');

    const textos = TEXTOS_MODO[modo];
    const titulo = _authEl('loginTitulo');
    const sub = _authEl('loginSubtitulo');
    if (titulo) titulo.textContent = textos.titulo;
    if (sub) sub.textContent = textos.sub;

    Object.keys(VISIVEL_EM).forEach(id => {
        const el = _authEl(id);
        if (el) el.classList.toggle('hidden', !VISIVEL_EM[id].includes(modo));
    });

    const abaEntrar = _authEl('abaEntrar');
    const abaCriar = _authEl('abaCriar');
    if (abaEntrar) {
        abaEntrar.className = modo === 'criar' ? CLASSE_ABA_INATIVA : CLASSE_ABA_ATIVA;
        abaEntrar.setAttribute('aria-selected', String(modo !== 'criar'));
    }
    if (abaCriar) {
        abaCriar.className = modo === 'criar' ? CLASSE_ABA_ATIVA : CLASSE_ABA_INATIVA;
        abaCriar.setAttribute('aria-selected', String(modo === 'criar'));
    }

    const senha = _authEl('authSenha');
    if (senha) senha.setAttribute('autocomplete', modo === 'entrar' ? 'current-password' : 'new-password');

    _limparSenhas();

    const sTexto = _authEl('btnAuthSubmitTexto');
    if (sTexto) sTexto.textContent = textos.botao;
}

/** Mostra/oculta o texto digitado nos campos de senha. */
function alternarVisibilidadeSenha() {
    const btn = _authEl('btnVerSenha');
    const senha = _authEl('authSenha');
    const confirmar = _authEl('authConfirmar');
    if (!senha) return;

    const mostrar = senha.type === 'password';
    senha.type = mostrar ? 'text' : 'password';
    if (confirmar) confirmar.type = mostrar ? 'text' : 'password';
    if (btn) {
        btn.textContent = mostrar ? 'Ocultar' : 'Mostrar';
        btn.setAttribute('aria-pressed', String(mostrar));
    }
}

/** Lê erros devolvidos na URL (OAuth, link de e-mail expirado, etc.). */
function lerErroDaUrl() {
    const params = new URLSearchParams(URL_INICIAL.search);
    const hash = new URLSearchParams(URL_INICIAL.hash.replace(/^#/, ''));
    const descricao = params.get('error_description') || hash.get('error_description');
    const codigo = params.get('error') || hash.get('error');
    const codigoErro = params.get('error_code') || hash.get('error_code');

    if (!codigo && !descricao) return null;

    // Limpa a URL para o erro não reaparecer ao recarregar
    window.history.replaceState({}, document.title, window.location.pathname);

    if (codigoErro === 'otp_expired') return 'O link expirou ou já foi usado. Peça um novo.';
    return descricao || codigo;
}

/** Converte erros do Supabase em mensagens claras, em português. */
function traduzirErroAuth(err) {
    const code = (err && err.code) || '';
    const msg = ((err && err.message) || '').toLowerCase();

    if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (code === 'user_already_exists' || msg.includes('already registered')) return 'Este e-mail já tem conta. Use a aba Entrar.';
    if (code === 'weak_password' || msg.includes('password should be')) return 'Senha fraca. Use pelo menos ' + MIN_SENHA + ' caracteres.';
    if (code === 'same_password') return 'A nova senha precisa ser diferente da atual.';
    if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    if (code === 'email_address_invalid') return 'Esse e-mail não é aceito. Confira o endereço.';
    if (code === 'signup_disabled') return 'O cadastro por e-mail está desativado neste projeto.';
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Sem conexão. Verifique sua internet e tente de novo.';

    return 'Não foi possível concluir. Tente de novo.' + (err && err.message ? ' (' + err.message + ')' : '');
}

/* ─── Dados do usuário na interface ─────────────────── */

function _dadosDoUsuario(user) {
    const meta = (user && user.user_metadata) || {};
    return {
        nome: meta.full_name || meta.name || '',
        email: user ? (user.email || meta.email || '') : '',
        avatarUrl: meta.avatar_url || meta.picture || ''
    };
}

/** Cria um <img> com a foto do usuário (sem referrer, evita bloqueio 403). */
function _criarImgAvatar(url, classes) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Foto de perfil';
    img.referrerPolicy = 'no-referrer';
    img.className = classes;
    return img;
}

/**
 * Renderiza nome, e-mail e foto do usuário logado (card em Perfil + header).
 * Também é chamada ao final de carregarPerfilUI() (script.js), pois ela
 * redefine o avatar do header com o emoji padrão.
 */
function aplicarUsuarioNaUI() {
    const { nome, email, avatarUrl } = _dadosDoUsuario(usuarioAtual);

    // Card "Sua conta" na página de Perfil
    const elNome = _authEl('contaNome');
    const elEmail = _authEl('contaEmail');
    const elAvatar = _authEl('contaAvatar');
    if (elNome) elNome.textContent = nome || (email ? email.split('@')[0] : 'Usuário');
    if (elEmail) elEmail.textContent = email;
    if (elAvatar) {
        elAvatar.innerHTML = '';
        if (avatarUrl) {
            elAvatar.appendChild(_criarImgAvatar(avatarUrl, 'w-full h-full object-cover'));
        } else {
            elAvatar.innerHTML = '<i class="fa-solid fa-user text-slate-400 text-xl"></i>';
        }
    }

    // Foto no botão de perfil do header (só quando a conta tem foto)
    const avatarHeader = _authEl('avatarHeader');
    if (avatarHeader && usuarioAtual && avatarUrl) {
        avatarHeader.innerHTML = '';
        avatarHeader.appendChild(_criarImgAvatar(avatarUrl, 'w-full h-full rounded-lg object-cover'));
    }
}

/** Usa o nome da conta como nome do perfil apenas se o usuário ainda não personalizou. */
function sincronizarNomeDoPerfil() {
    if (!usuarioAtual || typeof perfil === 'undefined') return;
    const { nome } = _dadosDoUsuario(usuarioAtual);
    if (nome && (!perfil.nome || perfil.nome === 'Atleta')) {
        perfil.nome = nome.slice(0, 30);
        localStorage.setItem('gymflow_perfil', JSON.stringify(perfil));
        localStorage.setItem('gymflow_nome', perfil.nome);
        if (typeof carregarPerfilUI === 'function') carregarPerfilUI();
    }
}

/* ─── Estado da sessão ──────────────────────────────── */

function aplicarSessao(session) {
    usuarioAtual = session && session.user ? session.user : null;

    // Durante a redefinição de senha o app continua bloqueado
    const liberar = !!usuarioAtual && !emRecuperacao;
    alternarTelaLogin(liberar);

    if (liberar) {
        mostrarErroLogin('');
        _limparSenhas();
        sincronizarNomeDoPerfil();
    } else {
        setOcupado(false);
    }

    aplicarUsuarioNaUI();
}

/* ─── Ações ─────────────────────────────────────────── */

function _emailValido(email) {
    return /^\S+@\S+\.\S+$/.test(email);
}

/** Valida os campos do modo atual. Retorna { ok, msg, campo }. */
function validarCampos() {
    const senha = _valor('authSenha');

    if (modoAuth !== 'redefinir') {
        const email = _valor('authEmail').trim();
        if (!_emailValido(email)) return { ok: false, msg: 'Digite um e-mail válido.', campo: 'authEmail' };
    }
    if (senha.length < MIN_SENHA) {
        return { ok: false, msg: 'A senha precisa ter pelo menos ' + MIN_SENHA + ' caracteres.', campo: 'authSenha' };
    }
    if (modoAuth !== 'entrar' && senha !== _valor('authConfirmar')) {
        return { ok: false, msg: 'As senhas não coincidem.', campo: 'authConfirmar' };
    }
    return { ok: true };
}

/** Envio do formulário: entrar, criar conta ou salvar nova senha. */
async function enviarFormAuth(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();

    if (!supabaseClient) {
        mostrarErroLogin('Não foi possível iniciar o login (SDK do Supabase indisponível). Verifique sua conexão e recarregue.');
        return;
    }

    _limparInvalidos();
    mostrarErroLogin('');

    const validacao = validarCampos();
    if (!validacao.ok) {
        mostrarErroLogin(validacao.msg);
        _marcarInvalido(validacao.campo, true);
        const campo = _authEl(validacao.campo);
        if (campo && campo.focus) campo.focus();
        return;
    }

    const email = _valor('authEmail').trim();
    const senha = _valor('authSenha');

    setOcupado(true, { submit: TEXTOS_MODO[modoAuth].ocupado });

    try {
        if (modoAuth === 'entrar') {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
            if (error) throw error;
            aplicarSessao(data.session);

        } else if (modoAuth === 'criar') {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password: senha,
                options: { emailRedirectTo: window.location.origin }
            });
            if (error) throw error;

            if (data.session) {
                // Confirmação de e-mail desativada no projeto: já entra logado
                aplicarSessao(data.session);
            } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                // O Supabase devolve um usuário "vazio" quando o e-mail já existe
                mostrarErroLogin('Este e-mail já tem conta. Use a aba Entrar.');
                _marcarInvalido('authEmail', true);
            } else {
                alternarModoAuth('entrar');
                mostrarAvisoLogin('Enviamos um link de confirmação para ' + email + '. Abra o e-mail e depois entre aqui.');
            }

        } else if (modoAuth === 'redefinir') {
            const { data, error } = await supabaseClient.auth.updateUser({ password: senha });
            if (error) throw error;
            emRecuperacao = false;
            aplicarSessao({ user: data.user });
            if (typeof mostrarToast === 'function') mostrarToast('Senha atualizada.');
        }
    } catch (err) {
        console.error('[GymFlow Auth] ❌', modoAuth, err && err.message);
        mostrarErroLogin(traduzirErroAuth(err));
    } finally {
        setOcupado(false);
    }
}

/** Envia o link de redefinição de senha para o e-mail digitado. */
async function esqueciSenha() {
    if (!supabaseClient) return;

    const email = _valor('authEmail').trim();
    if (!_emailValido(email)) {
        mostrarErroLogin('Digite seu e-mail no campo acima para receber o link de redefinição.');
        _marcarInvalido('authEmail', true);
        const campo = _authEl('authEmail');
        if (campo && campo.focus) campo.focus();
        return;
    }

    _limparInvalidos();
    setOcupado(true);

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        mostrarAvisoLogin('Se houver uma conta para ' + email + ', enviamos um link para redefinir a senha.');
    } catch (err) {
        console.error('[GymFlow Auth] ❌ resetPasswordForEmail:', err && err.message);
        mostrarErroLogin(traduzirErroAuth(err));
    } finally {
        setOcupado(false);
    }
}

/** Dispara o login social: redireciona para o Google via Supabase. */
async function entrarComGoogle() {
    if (!supabaseClient) {
        mostrarErroLogin('Não foi possível iniciar o login (SDK do Supabase indisponível). Verifique sua conexão e recarregue.');
        return;
    }

    mostrarErroLogin('');
    setOcupado(true, { google: 'Redirecionando para o Google...' });

    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });

    // Em caso de sucesso o navegador já está indo para o Google.
    if (error) {
        console.error('[GymFlow Auth] ❌ signInWithOAuth:', error.message);
        setOcupado(false);
        mostrarErroLogin('Erro ao iniciar o login com Google: ' + error.message);
    }
}

/** Encerra a sessão do usuário. */
async function sair() {
    if (!supabaseClient) return;

    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('[GymFlow Auth] ❌ signOut:', error.message);
        if (typeof mostrarToast === 'function') mostrarToast('Não foi possível sair. Tente novamente.', 'erro');
        return;
    }

    emRecuperacao = false;
    alternarModoAuth('entrar');
    aplicarSessao(null);
    if (typeof mostrarPagina === 'function') mostrarPagina('inicio');
}

/* ─── Inicialização ─────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async function () {
    const erroDaUrl = lerErroDaUrl();

    if (!supabaseClient) {
        alternarTelaLogin(false);
        setOcupado(false);
        mostrarErroLogin('SDK do Supabase não carregou. Verifique sua conexão e recarregue a página.');
        return;
    }

    // Link de "esqueci minha senha": o usuário chega com uma sessão temporária
    emRecuperacao = /(^|[#&])type=recovery(&|$)/.test(URL_INICIAL.hash);
    if (emRecuperacao) alternarModoAuth('redefinir');

    // Reage a login, logout e renovação de token (inclusive em outras abas)
    supabaseClient.auth.onAuthStateChange((evento, session) => {
        console.log('[GymFlow Auth] evento:', evento);
        if (evento === 'PASSWORD_RECOVERY') {
            emRecuperacao = true;
            alternarModoAuth('redefinir');
        }
        aplicarSessao(session);
    });

    try {
        // Sessão ativa (inclui a que acabou de voltar do Google)
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        aplicarSessao(data.session);
    } catch (err) {
        console.error('[GymFlow Auth] ❌ getSession:', err.message);
        aplicarSessao(null);
    }

    if (erroDaUrl) mostrarErroLogin('Falha no acesso: ' + erroDaUrl);
});
