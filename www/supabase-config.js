/* =====================================================
   GYMFLOW — SUPABASE CONFIGURATION & CRUD ENGINE
   
   ⚠️  ATENÇÃO: Substitua os valores abaixo pelas suas credenciais do Supabase.
   
   SQL para criar as tabelas (execute no SQL Editor do Supabase):
   
   -- 1. Tabela de perfis de usuário
   CREATE TABLE IF NOT EXISTS public.perfis (
       id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       device_id   TEXT UNIQUE NOT NULL,
       nome        TEXT NOT NULL DEFAULT 'Atleta',
       avatar      TEXT DEFAULT '🏋️',
       peso_corporal NUMERIC(5,1),
       altura      INTEGER,
       meta        TEXT DEFAULT 'Hipertrofia',
       nivel       TEXT DEFAULT 'Intermediário',
       atualizado_em TIMESTAMPTZ DEFAULT NOW()
   );

   -- 2. Tabela de histórico de treinos (CRUD principal)
   CREATE TABLE IF NOT EXISTS public.historico_treinos (
       id          BIGSERIAL PRIMARY KEY,
       device_id   TEXT NOT NULL,
       treino      TEXT NOT NULL,
       letra       TEXT NOT NULL,
       exercicio   TEXT NOT NULL,
       grupo       TEXT NOT NULL,
       peso        NUMERIC(6,2) NOT NULL,
       repeticoes  INTEGER NOT NULL,
       volume      NUMERIC(10,2),
       data        TEXT NOT NULL,
       hora        TEXT,
       criado_em   TIMESTAMPTZ DEFAULT NOW()
   );

   -- 3. Índice para performance (buscar por device)
   CREATE INDEX IF NOT EXISTS idx_historico_device ON public.historico_treinos(device_id);
   CREATE INDEX IF NOT EXISTS idx_historico_exercicio ON public.historico_treinos(exercicio);

   -- 4. RLS (Row Level Security) - opcional mas recomendado
   -- ALTER TABLE public.historico_treinos ENABLE ROW LEVEL SECURITY;
   -- ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
   -- CREATE POLICY "Device can manage own data" ON public.historico_treinos
   --   USING (device_id = current_setting('app.device_id', true))
   --   WITH CHECK (device_id = current_setting('app.device_id', true));

   -- 5. Habilitar REALTIME (execute no SQL Editor):
   -- ALTER PUBLICATION supabase_realtime ADD TABLE public.historico_treinos;

===================================================== */

// ── SUBSTITUA AQUI COM SUAS CREDENCIAIS ──────────────────────────────────────
const SUPABASE_URL = 'https://arxugcqkubcxqsecvnfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeHVnY3FrdWJjeHFzZWN2bmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MTk5OTcsImV4cCI6MjEwNjQ5NTk5N30.H7oNro7veC5MYFFU5GnFEU-JYkIEEfD8EcSGZKI7PRo';
// ─────────────────────────────────────────────────────────────────────────────

/* =====================================================
   DEVICE ID — identificador único do dispositivo
   (gerado automaticamente e persistido no localStorage)
===================================================== */
function obterDeviceId() {
    let deviceId = localStorage.getItem('gymflow_device_id');
    if (!deviceId) {
        // Gera UUID v4 simples
        deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('gymflow_device_id', deviceId);
    }
    return deviceId;
}

const DEVICE_ID = obterDeviceId();

/* =====================================================
   CLASSE DE INTEGRAÇÃO SUPABASE (CRUD + REALTIME)
===================================================== */
class GymFlowSupabase {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_ANON_KEY;
        this.deviceId = DEVICE_ID;
        this.headers = {
            'Content-Type': 'application/json',
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Prefer': 'return=representation'
        };
        this.isConnected = false;
        this.realtimeChannel = null;
        this._verificarConexao();
    }

    /* ─── VERIFICAÇÃO DE CONEXÃO ─────────────────────────── */
    async _verificarConexao() {
        if (!this.url || this.url === 'COLE_SUA_URL_AQUI') {
            console.warn('[GymFlow Supabase] ⚠️ Credenciais não configuradas. Rodando em modo offline (localStorage).');
            this.isConnected = false;
            this._atualizarBadgeConexao(false);
            return;
        }

        // Mostrar badge enquanto verifica
        const badge = document.getElementById('badgeConexaoNuvem');
        if (badge) badge.classList.remove('hidden');

        try {
            const res = await fetch(`${this.url}/rest/v1/historico_treinos?select=id&limit=1&device_id=eq.${this.deviceId}`, {
                headers: this.headers
            });
            this.isConnected = res.ok;
            if (this.isConnected) {
                console.log('[GymFlow Supabase] ✅ Conexão estabelecida com o banco de dados.');
                this._atualizarBadgeConexao(true);
                this._iniciarRealtime();
            } else {
                console.warn('[GymFlow Supabase] ⚠️ Falha ao conectar. Status:', res.status);
                this._atualizarBadgeConexao(false);
            }
        } catch (err) {
            console.error('[GymFlow Supabase] ❌ Erro de rede ao verificar conexão:', err.message);
            this.isConnected = false;
            this._atualizarBadgeConexao(false);
        }
    }

    /* ─── MÉTODO AUXILIAR: FETCH COM TRATAMENTO DE ERRO ──── */
    async _fetch(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const res = await fetch(url, {
            headers: this.headers,
            ...options
        });
        if (!res.ok) {
            const erro = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(`Supabase Error [${res.status}]: ${erro.message || JSON.stringify(erro)}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
    }

    /* =====================================================
       CRUD — HISTÓRICO DE TREINOS
    ===================================================== */

    /**
     * CREATE: Insere um novo registro de exercício no banco.
     * Chamado após o usuário salvar uma série.
     * @param {Object} registro - Objeto com dados do exercício
     * @returns {Object} - Registro inserido com ID do banco
     */
    async inserirRegistro(registro) {
        if (!this.isConnected) {
            console.log('[GymFlow] Offline: usando localStorage.');
            return registro;
        }

        try {
            const payload = {
                device_id: this.deviceId,
                treino: registro.treino,
                letra: registro.letra,
                exercicio: registro.exercicio,
                grupo: registro.grupo,
                peso: registro.peso,
                repeticoes: registro.repeticoes,
                volume: registro.volume,
                data: registro.data,
                hora: registro.hora
            };

            const dados = await this._fetch('historico_treinos', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const inserido = Array.isArray(dados) ? dados[0] : dados;
            console.log('[GymFlow] ✅ INSERT registro:', inserido?.id);

            // Retornar com ID do banco (sobrescreve o ID local)
            return {
                ...registro,
                id: inserido?.id || registro.id,
                _db_id: inserido?.id
            };
        } catch (err) {
            console.error('[GymFlow] ❌ Erro ao inserir registro:', err.message);
            mostrarToast('Salvo localmente (sem conexão com nuvem)', 'info');
            return registro;
        }
    }

    /**
     * READ: Carrega todos os registros do dispositivo a partir do banco.
     * Chamado na inicialização para sincronizar com o banco remoto.
     * @returns {Array} - Lista de registros ordenados por data (mais recente primeiro)
     */
    async carregarHistorico() {
        if (!this.isConnected) {
            console.log('[GymFlow] Offline: carregando do localStorage.');
            return null; // Sinaliza para usar localStorage
        }

        try {
            const dados = await this._fetch(
                `historico_treinos?device_id=eq.${this.deviceId}&order=criado_em.desc&limit=500`
            );

            console.log(`[GymFlow] ✅ READ: ${dados.length} registros carregados do Supabase.`);

            // Converter formato do banco para formato local
            return dados.map(item => ({
                id: item.id,
                _db_id: item.id,
                data: item.data,
                hora: item.hora || '',
                treino: item.treino,
                letra: item.letra,
                exercicio: item.exercicio,
                grupo: item.grupo,
                peso: Number(item.peso),
                repeticoes: Number(item.repeticoes),
                volume: Number(item.volume) || (Number(item.peso) * Number(item.repeticoes))
            }));
        } catch (err) {
            console.error('[GymFlow] ❌ Erro ao carregar histórico:', err.message);
            return null;
        }
    }

    /**
     * UPDATE: Atualiza um registro existente no banco.
     * Chamado ao editar um exercício já salvo.
     * @param {number|string} id - ID do banco do registro
     * @param {Object} dadosAtualizados - Campos a serem atualizados
     * @returns {boolean} - true se bem-sucedido
     */
    async atualizarRegistro(id, dadosAtualizados) {
        if (!this.isConnected) {
            console.log('[GymFlow] Offline: update apenas no localStorage.');
            return false;
        }

        try {
            const payload = {};
            if (dadosAtualizados.peso !== undefined) payload.peso = dadosAtualizados.peso;
            if (dadosAtualizados.repeticoes !== undefined) payload.repeticoes = dadosAtualizados.repeticoes;
            if (dadosAtualizados.volume !== undefined) payload.volume = dadosAtualizados.volume;

            await this._fetch(`historico_treinos?id=eq.${id}&device_id=eq.${this.deviceId}`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });

            console.log('[GymFlow] ✅ UPDATE registro:', id);
            return true;
        } catch (err) {
            console.error('[GymFlow] ❌ Erro ao atualizar registro:', err.message);
            return false;
        }
    }

    /**
     * DELETE: Remove um registro do banco pelo ID.
     * Chamado ao excluir um item do histórico.
     * @param {number|string} id - ID do banco do registro
     * @returns {boolean} - true se bem-sucedido
     */
    async excluirRegistro(id) {
        if (!this.isConnected) {
            console.log('[GymFlow] Offline: delete apenas no localStorage.');
            return false;
        }

        try {
            await this._fetch(`historico_treinos?id=eq.${id}&device_id=eq.${this.deviceId}`, {
                method: 'DELETE',
                headers: { ...this.headers, 'Prefer': '' }
            });
            console.log('[GymFlow] ✅ DELETE registro:', id);
            return true;
        } catch (err) {
            console.error('[GymFlow] ❌ Erro ao excluir registro:', err.message);
            return false;
        }
    }

    /**
     * DELETE ALL: Remove todos os registros do dispositivo (limpar histórico).
     * @returns {boolean} - true se bem-sucedido
     */
    async limparHistorico() {
        if (!this.isConnected) {
            console.log('[GymFlow] Offline: limpeza apenas no localStorage.');
            return false;
        }

        try {
            await this._fetch(`historico_treinos?device_id=eq.${this.deviceId}`, {
                method: 'DELETE',
                headers: { ...this.headers, 'Prefer': '' }
            });
            console.log('[GymFlow] ✅ DELETE ALL registros do device.');
            return true;
        } catch (err) {
            console.error('[GymFlow] ❌ Erro ao limpar histórico:', err.message);
            return false;
        }
    }

    /* =====================================================
       CRUD — PERFIL DO USUÁRIO
    ===================================================== */

    /**
     * UPSERT PERFIL: Insere ou atualiza o perfil do usuário no banco.
     * @param {Object} dadosPerfil - Dados do perfil
     */
    async salvarPerfil(dadosPerfil) {
        if (!this.isConnected) return;

        try {
            const payload = {
                device_id: this.deviceId,
                nome: dadosPerfil.nome,
                avatar: dadosPerfil.avatar,
                peso_corporal: dadosPerfil.pesoCorporal || null,
                altura: dadosPerfil.altura || null,
                meta: dadosPerfil.meta,
                nivel: dadosPerfil.nivel || 'Intermediário',
                atualizado_em: new Date().toISOString()
            };

            await this._fetch('perfis?device_id=eq.' + this.deviceId, {
                method: 'POST',
                headers: {
                    ...this.headers,
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify(payload)
            });
            console.log('[GymFlow] ✅ UPSERT perfil salvo no Supabase.');
        } catch (err) {
            console.error('[GymFlow] ❌ Erro ao salvar perfil:', err.message);
        }
    }

    /**
     * LOAD PERFIL: Carrega o perfil do usuário do banco.
     * @returns {Object|null} - Dados do perfil ou null
     */
    async carregarPerfil() {
        if (!this.isConnected) return null;

        try {
            const dados = await this._fetch(`perfis?device_id=eq.${this.deviceId}&limit=1`);
            if (dados && dados.length > 0) {
                const p = dados[0];
                return {
                    nome: p.nome,
                    avatar: p.avatar || '🏋️',
                    pesoCorporal: p.peso_corporal || '',
                    altura: p.altura || '',
                    meta: p.meta || 'Hipertrofia',
                    nivel: p.nivel || 'Intermediário'
                };
            }
            return null;
        } catch (err) {
            console.error('[GymFlow] ❌ Erro ao carregar perfil:', err.message);
            return null;
        }
    }

    /* =====================================================
       REALTIME — SINCRONIZAÇÃO EM TEMPO REAL
       Usa Supabase Realtime via WebSocket (Postgres CDC)
    ===================================================== */

    /**
     * Inicia a escuta de eventos em tempo real na tabela historico_treinos.
     * Quando outro dispositivo/aba insere, atualiza ou deleta um registro,
     * a UI é atualizada automaticamente sem precisar recarregar a página.
     */
    _iniciarRealtime() {
        if (!this.url || this.url === 'COLE_SUA_URL_AQUI') return;

        // URL do WebSocket do Supabase Realtime
        const wsUrl = this.url.replace('https://', 'wss://').replace('http://', 'ws://');
        const realtimeUrl = `${wsUrl}/realtime/v1/websocket?apikey=${this.key}&vsn=1.0.0`;

        try {
            this.realtimeChannel = new WebSocket(realtimeUrl);

            this.realtimeChannel.onopen = () => {
                console.log('[GymFlow Realtime] 🔌 WebSocket conectado!');
                this._atualizarBadgeConexao(true);

                // Enviar mensagem de join no canal da tabela
                this.realtimeChannel.send(JSON.stringify({
                    topic: `realtime:public:historico_treinos:device_id=eq.${this.deviceId}`,
                    event: 'phx_join',
                    payload: {},
                    ref: '1'
                }));
            };

            this.realtimeChannel.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this._processarMensagemRealtime(msg);
                } catch (e) {
                    // Mensagem não é JSON válido — ignorar
                }
            };

            this.realtimeChannel.onclose = () => {
                console.log('[GymFlow Realtime] 🔌 WebSocket desconectado. Tentando reconectar em 5s...');
                this._atualizarBadgeConexao(false);
                // Tentar reconectar após 5 segundos
                setTimeout(() => {
                    if (this.isConnected) this._iniciarRealtime();
                }, 5000);
            };

            this.realtimeChannel.onerror = (err) => {
                console.warn('[GymFlow Realtime] Erro no WebSocket (modo polling ativo como fallback).');
                this._atualizarBadgeConexao(false);
            };

        } catch (err) {
            console.warn('[GymFlow Realtime] WebSocket não suportado. Usando polling a cada 30s.');
            this._iniciarPolling();
        }
    }

    /**
     * Processa eventos recebidos pelo Realtime (INSERT/UPDATE/DELETE).
     * Atualiza o estado local e re-renderiza a UI automaticamente.
     */
    _processarMensagemRealtime(msg) {
        // Filtrar apenas eventos de mudança no banco
        if (!msg.event || !msg.payload) return;

        const evento = msg.event;
        const payload = msg.payload;

        // Eventos do Postgres CDC
        if (evento === 'INSERT' && payload.type === 'INSERT') {
            const novo = payload.record;
            if (novo.device_id !== this.deviceId) return; // Ignorar de outros devices

            const registroFormatado = {
                id: novo.id,
                _db_id: novo.id,
                data: novo.data,
                hora: novo.hora || '',
                treino: novo.treino,
                letra: novo.letra,
                exercicio: novo.exercicio,
                grupo: novo.grupo,
                peso: Number(novo.peso),
                repeticoes: Number(novo.repeticoes),
                volume: Number(novo.volume)
            };

            // Verificar se já existe localmente (evitar duplicatas)
            if (!historico.find(h => h._db_id === novo.id)) {
                historico.unshift(registroFormatado);
                _sincronizarEstadoLocal();
                console.log('[GymFlow Realtime] 🆕 INSERT recebido:', novo.exercicio);
            }

        } else if (evento === 'UPDATE' && payload.type === 'UPDATE') {
            const atualizado = payload.record;
            const index = historico.findIndex(h => h._db_id === atualizado.id);
            if (index !== -1) {
                historico[index] = {
                    ...historico[index],
                    peso: Number(atualizado.peso),
                    repeticoes: Number(atualizado.repeticoes),
                    volume: Number(atualizado.volume)
                };
                _sincronizarEstadoLocal();
                console.log('[GymFlow Realtime] ✏️ UPDATE recebido:', atualizado.id);
            }

        } else if (evento === 'DELETE' && payload.type === 'DELETE') {
            const deletado = payload.old_record;
            historico = historico.filter(h => h._db_id !== deletado.id);
            _sincronizarEstadoLocal();
            console.log('[GymFlow Realtime] 🗑️ DELETE recebido:', deletado.id);
        }
    }

    /**
     * Fallback: Polling a cada 30 segundos se WebSocket não funcionar.
     */
    _iniciarPolling() {
        setInterval(async () => {
            const dados = await this.carregarHistorico();
            if (dados !== null) {
                historico = dados;
                _sincronizarEstadoLocal();
                console.log('[GymFlow Polling] 🔄 Histórico sincronizado via polling.');
            }
        }, 30000);
    }

    /**
     * Atualiza o indicador visual de conexão com a nuvem no header do app.
     */
    _atualizarBadgeConexao(conectado) {
        const badge = document.getElementById('badgeConexaoNuvem');
        if (!badge) return;
        if (conectado) {
            badge.innerHTML = '<i class="fa-solid fa-cloud-arrow-up text-gym-400"></i><span class="text-gym-400">Nuvem</span>';
            badge.title = 'Sincronizado com o Supabase em tempo real';
        } else {
            badge.innerHTML = '<i class="fa-solid fa-cloud-slash text-slate-500"></i><span class="text-slate-500">Offline</span>';
            badge.title = 'Sem conexão com a nuvem — dados salvos localmente';
        }
    }
}

/* =====================================================
   FUNÇÃO GLOBAL: Sincroniza estado em memória → UI
   Chamada toda vez que o array `historico` muda.
===================================================== */
function _sincronizarEstadoLocal() {
    // Persistir no localStorage como backup
    localStorage.setItem('gymflow_historico', JSON.stringify(historico));

    // Re-renderizar componentes da UI que dependem do histórico
    if (typeof mostrarHistorico === 'function') mostrarHistorico();
    if (typeof atualizarResumoDashboard === 'function') atualizarResumoDashboard();
    if (typeof atualizarEstatisticasHistorico === 'function') atualizarEstatisticasHistorico();

    // Re-renderizar gráfico somente se a página de histórico estiver visível
    const paginaHistorico = document.getElementById('pagina-historico');
    if (paginaHistorico && !paginaHistorico.classList.contains('hidden')) {
        if (typeof renderizarGraficoEvolucao === 'function') renderizarGraficoEvolucao();
    }
}

/* =====================================================
   INICIALIZAR INSTÂNCIA GLOBAL DO CLIENTE SUPABASE
===================================================== */
const gymflowDB = new GymFlowSupabase();
