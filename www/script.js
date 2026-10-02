/* =====================================================
   GYMFLOW - JAVASCRIPT CORE & ENGINE
===================================================== */

/* =====================================================
   ESTADO GLOBAL & LOCALSTORAGE
===================================================== */
let treinoAtual = null;
let exerciciosConcluidos = {};
let historico = JSON.parse(localStorage.getItem("gymflow_historico")) || [];
let perfil = JSON.parse(localStorage.getItem("gymflow_perfil")) || {
    nome: localStorage.getItem("gymflow_nome") || "Atleta",
    avatar: "🏋️",
    pesoCorporal: "",
    altura: "",
    meta: "Hipertrofia",
    nivel: "Intermediário"
};
let preferencias = JSON.parse(localStorage.getItem("gymflow_preferencias")) || {
    som: true,
    autoTimer: true
};

// Cronômetro de descanso
let timerConfig = {
    tempoTotal: 60,
    tempoRestante: 60,
    intervalo: null,
    estaRodando: false
};

// Cronômetro da sessão de treino
let sessaoTreino = {
    segundos: 0,
    intervalo: null
};

// Gráficos e Filtros
let graficoInstancia = null;
let modoGrafico = 'peso'; // 'peso' ou 'volume'
let filtroHistoricoAtual = 'TODOS';


/* =====================================================
   INICIALIZAÇÃO DA APLICAÇÃO
===================================================== */
document.addEventListener("DOMContentLoaded", async function () {
    inicializarDataHero();
    mostrarFraseMotivacional();
    inicializarPreferenciasUI();
    mostrarTreinos();

    // ── SINCRONIZAÇÃO INICIAL COM SUPABASE ─────────────────
    // Tenta carregar dados da nuvem; se falhar, usa localStorage
    await sincronizarDadosIniciais();
    // ──────────────────────────────────────────────────────────

    carregarPerfilUI();
    atualizarResumoDashboard();
    mostrarHistorico();
    atualizarEstatisticasHistorico();
});

/**
 * Sincronização inicial: tenta buscar dados do Supabase.
 * Se bem-sucedido, atualiza o array local e o localStorage.
 * Se falhar, mantém os dados do localStorage (modo offline).
 */
async function sincronizarDadosIniciais() {
    // Aguardar gymflowDB estar disponível (pode levar um tick)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Tentar carregar perfil da nuvem
    if (typeof gymflowDB !== 'undefined' && gymflowDB.isConnected) {
        const perfilNuvem = await gymflowDB.carregarPerfil();
        if (perfilNuvem) {
            perfil = { ...perfil, ...perfilNuvem };
            localStorage.setItem("gymflow_perfil", JSON.stringify(perfil));
            console.log('[GymFlow] Perfil sincronizado da nuvem.');
        }

        // Carregar histórico da nuvem (sobrescreve o localStorage se bem-sucedido)
        const historicoNuvem = await gymflowDB.carregarHistorico();
        if (historicoNuvem !== null) {
            historico = historicoNuvem;
            localStorage.setItem("gymflow_historico", JSON.stringify(historico));
            console.log(`[GymFlow] ${historico.length} registros sincronizados da nuvem.`);
            mostrarToast(`${historico.length} registros carregados da nuvem ☁️`, 'info');
        }
    } else {
        console.log('[GymFlow] Modo offline: usando dados do localStorage.');
    }
}


/* =====================================================
   ÁUDIO & FEEDBACK SONORO (WEB AUDIO API)
===================================================== */
function tocarSom(tipo = 'beep') {
    if (!preferencias.som) return;

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        if (tipo === 'beep') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Nota A5
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
        } else if (tipo === 'sucesso') {
            // Acorde de conclusão (C5 -> E5 -> G5)
            const notas = [523.25, 659.25, 783.99, 1046.50];
            notas.forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (i * 0.08));
                gain.gain.setValueAtTime(0.12, audioCtx.currentTime + (i * 0.08));
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (i * 0.08) + 0.35);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + (i * 0.08));
                osc.stop(audioCtx.currentTime + (i * 0.08) + 0.35);
            });
        } else if (tipo === 'alerta') {
            // Alarme duplo para término do descanso
            [880, 880].forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (i * 0.2));
                gain.gain.setValueAtTime(0.1, audioCtx.currentTime + (i * 0.2));
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (i * 0.2) + 0.15);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + (i * 0.2));
                osc.stop(audioCtx.currentTime + (i * 0.2) + 0.15);
            });
        }
    } catch (e) {
        console.warn("Web Audio não suportado ou bloqueado:", e);
    }
}


/* =====================================================
   SISTEMA DE TOAST NOTIFICATIONS
===================================================== */
function mostrarToast(mensagem, tipo = 'sucesso') {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-2 opacity-0
        ${tipo === 'sucesso' 
            ? 'bg-dark-900/95 border-gym-500/50 text-white shadow-glow' 
            : tipo === 'erro' 
            ? 'bg-dark-900/95 border-red-500/50 text-white shadow-red-950/40' 
            : 'bg-dark-900/95 border-slate-700 text-white'}
    `;

    const icone = tipo === 'sucesso' 
        ? '<i class="fa-solid fa-circle-check text-gym-400 text-base"></i>' 
        : tipo === 'erro' 
        ? '<i class="fa-solid fa-circle-exclamation text-red-400 text-base"></i>' 
        : '<i class="fa-solid fa-circle-info text-cyan-400 text-base"></i>';

    toast.innerHTML = `
        ${icone}
        <p class="text-xs font-bold flex-1">${mensagem}</p>
    `;

    container.appendChild(toast);

    // Animação de entrada
    requestAnimationFrame(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
        toast.classList.add("translate-y-0", "opacity-100");
    });

    // Remover após 3 segundos
    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-x-4");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


/* =====================================================
   NAVEGAÇÃO PRINCIPAL (PÁGINAS)
===================================================== */
function mostrarPagina(pagina) {
    const paginas = document.querySelectorAll(".pagina");
    paginas.forEach(el => el.classList.add("hidden"));

    const paginaSelecionada = document.getElementById("pagina-" + pagina);
    if (paginaSelecionada) {
        paginaSelecionada.classList.remove("hidden");
    }

    // Atualizar menu inferior
    const botoes = document.querySelectorAll(".nav-button");
    botoes.forEach(b => {
        b.classList.remove("text-gym-400");
        b.classList.add("text-slate-500");
    });

    const botaoAtivo = document.getElementById("nav-" + pagina);
    if (botaoAtivo) {
        botaoAtivo.classList.remove("text-slate-500");
        botaoAtivo.classList.add("text-gym-400");
    }

    // Ações ao abrir páginas específicas
    if (pagina === "historico") {
        mostrarHistorico();
        atualizarEstatisticasHistorico();
        setTimeout(renderizarGraficoEvolucao, 100);
    } else if (pagina === "perfil") {
        carregarPerfilUI();
    } else if (pagina === "inicio") {
        atualizarResumoDashboard();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}


/* =====================================================
   HERO: DATA, SAUDAÇÃO & FRASE MOTIVACIONAL
===================================================== */
function inicializarDataHero() {
    const elementoData = document.getElementById("dataAtualExtenso");
    if (elementoData) {
        const hoje = new Date();
        const opcoes = { weekday: 'long', day: 'numeric', month: 'long' };
        let dataFormatada = hoje.toLocaleDateString('pt-BR', opcoes);
        // Capitalizar primeira letra
        dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
        elementoData.textContent = dataFormatada;
    }
}

function mostrarFraseMotivacional() {
    const elemento = document.getElementById("fraseMotivacional");
    if (elemento && typeof motivacionais !== "undefined" && motivacionais.length > 0) {
        const index = Math.floor(Math.random() * motivacionais.length);
        elemento.textContent = `"${motivacionais[index]}"`;
    }
}


/* =====================================================
   RENDERIZAR LISTA DE TREINOS (CARDS A, B, C, D)
===================================================== */
function mostrarTreinos(filtro = "") {
    const container = document.getElementById("listaTreinos");
    if (!container) return;

    container.innerHTML = "";
    const termo = filtro.toLowerCase().trim();

    Object.keys(treinos).forEach(letra => {
        const treino = treinos[letra];

        // Se houver busca, verificar se bate com o nome, título ou exercícios
        if (termo) {
            const bateTreino = treino.nome.toLowerCase().includes(termo) || 
                               treino.titulo.toLowerCase().includes(termo) ||
                               treino.descricao.toLowerCase().includes(termo);
            const bateExercicio = treino.exercicios.some(ex => 
                ex.nome.toLowerCase().includes(termo) || 
                ex.grupo.toLowerCase().includes(termo)
            );
            if (!bateTreino && !bateExercicio) return;
        }

        const card = document.createElement("div");
        card.className = `
            glass-card-interactive rounded-3xl p-5 sm:p-6 flex flex-col justify-between group cursor-pointer relative overflow-hidden border border-slate-800
        `;

        card.innerHTML = `
            <div>
                <div class="flex items-start justify-between gap-2 mb-4">
                    <div class="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr ${treino.cor} p-0.5 shadow-lg group-hover:scale-105 transition-transform">
                        <div class="w-full h-full bg-dark-900/90 rounded-[14px] flex items-center justify-center text-2xl sm:text-3xl">
                            ${treino.icone}
                        </div>
                    </div>
                    
                    <span class="text-[11px] font-black uppercase px-2.5 py-1 rounded-full ${treino.corBadge} border">
                        ${treino.tempoEstimado}
                    </span>
                </div>

                <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-gym-400 uppercase tracking-wider">Treino ${letra}</span>
                    <span class="text-slate-600 text-xs">•</span>
                    <span class="text-xs text-slate-400 font-medium">${treino.exercicios.length} exercícios</span>
                </div>

                <h3 class="text-lg sm:text-xl font-extrabold text-white mt-1 group-hover:text-gym-400 transition-colors">
                    ${treino.titulo}
                </h3>

                <p class="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-2">
                    ${treino.descricao}
                </p>

                <div class="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                    ${treino.exercicios.slice(0, 3).map(ex => `
                        <span class="text-[10px] bg-dark-850 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800">
                            ${ex.nome.split(' ')[0]} ${ex.nome.split(' ')[1] || ''}
                        </span>
                    `).join('')}
                    ${treino.exercicios.length > 3 ? `<span class="text-[10px] text-slate-500 font-bold self-center">+${treino.exercicios.length - 3}</span>` : ''}
                </div>
            </div>

            <div class="mt-6 flex items-center justify-between text-xs font-black text-gym-400 group-hover:translate-x-1 transition-transform">
                <span>Iniciar Treino</span>
                <i class="fa-solid fa-arrow-right"></i>
            </div>
        `;

        card.addEventListener("click", () => abrirTreino(letra));
        container.appendChild(card);
    });

    if (container.children.length === 0) {
        container.innerHTML = `
            <div class="col-span-full glass-card rounded-2xl p-8 text-center text-slate-400">
                <i class="fa-solid fa-magnifying-glass text-3xl text-slate-600 mb-3"></i>
                <p class="text-sm font-semibold">Nenhum treino ou exercício encontrado com esse termo.</p>
            </div>
        `;
    }
}

function filtrarTreinos(termo) {
    mostrarTreinos(termo);
}


/* =====================================================
   ABRIR FICHA DE TREINO (SESSÃO ATIVA)
===================================================== */
function abrirTreino(letra) {
    mostrarPagina("treinos");
    treinoAtual = letra;
    exerciciosConcluidos = {};

    const treino = treinos[letra];
    if (!treino) return;

    document.getElementById("nomeTreino").textContent = `${treino.nome} • ${treino.titulo}`;
    document.getElementById("descricaoTreino").textContent = treino.descricao;
    document.getElementById("treinoEtiqueta").textContent = `TREINO ${letra}`;
    document.getElementById("treinoIntensidade").innerHTML = `
        <i class="fa-solid fa-fire text-amber-400 text-[10px]"></i> Intensidade ${treino.intensidade} • ${treino.tempoEstimado}
    `;

    document.getElementById("areaTreino").classList.remove("hidden");

    // Iniciar cronômetro da sessão
    iniciarCronometroSessao();

    mostrarExercicios();
    atualizarProgresso();

    document.getElementById("areaTreino").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function fecharTreino() {
    document.getElementById("areaTreino").classList.add("hidden");
    pararCronometroSessao();
    treinoAtual = null;
    exerciciosConcluidos = {};
}

function iniciarCronometroSessao() {
    pararCronometroSessao();
    sessaoTreino.segundos = 0;
    const duracaoEl = document.getElementById("duracaoSessao");
    if (duracaoEl) duracaoEl.textContent = "00:00";

    sessaoTreino.intervalo = setInterval(() => {
        sessaoTreino.segundos++;
        const mins = String(Math.floor(sessaoTreino.segundos / 60)).padStart(2, '0');
        const secs = String(sessaoTreino.segundos % 60).padStart(2, '0');
        if (duracaoEl) duracaoEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function pararCronometroSessao() {
    if (sessaoTreino.intervalo) {
        clearInterval(sessaoTreino.intervalo);
        sessaoTreino.intervalo = null;
    }
}


/* =====================================================
   RENDERIZAR EXERCÍCIOS DA FICHA
===================================================== */
function mostrarExercicios() {
    const container = document.getElementById("listaExercicios");
    if (!container || !treinoAtual) return;

    container.innerHTML = "";
    const treino = treinos[treinoAtual];

    treino.exercicios.forEach((exercicio, index) => {
        // Encontrar último registro desse exercício no histórico para sugestão de carga
        const ultimoRegistro = historico.find(h => h.exercicio === exercicio.nome);
        const cargaSugerida = ultimoRegistro ? ultimoRegistro.peso : "";
        const repsSugerida = ultimoRegistro ? ultimoRegistro.repeticoes : exercicio.repeticoes;

        const card = document.createElement("div");
        card.id = "exercicio-" + exercicio.id;
        card.className = `
            bg-dark-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:border-slate-700
        `;

        card.innerHTML = `
            <div class="flex flex-col gap-4">
                
                <!-- TOPO DO EXERCÍCIO: NÚMERO, NOME, GRUPO E REST TIMER TRIGGER -->
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3">
                        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-dark-850 border border-slate-800 flex items-center justify-center font-black text-slate-300 text-sm flex-shrink-0">
                            ${index + 1}
                        </div>

                        <div>
                            <h4 class="text-base sm:text-lg font-black text-white leading-snug">
                                ${exercicio.nome}
                            </h4>

                            <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <span class="text-[11px] font-bold bg-gym-500/10 text-gym-400 border border-gym-500/20 px-2 py-0.5 rounded-full">
                                    ${exercicio.grupo}
                                </span>
                                <span class="text-[11px] font-medium bg-dark-850 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full">
                                    ${exercicio.series} séries × ${exercicio.repeticoes} reps
                                </span>
                                <button onclick="iniciarTimerPreset(${exercicio.descanso || 60})" title="Iniciar descanso sugerido" class="text-[11px] font-semibold bg-dark-850 hover:bg-gym-500/10 text-slate-400 hover:text-gym-400 border border-slate-800 hover:border-gym-500/30 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1">
                                    <i class="fa-regular fa-clock text-[10px]"></i> ${exercicio.descanso || 60}s descanso
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- BOTÃO DICA -->
                    <button onclick="toggleDica('${exercicio.id}')" title="Ver dica de execução" class="w-8 h-8 rounded-lg bg-dark-850 border border-slate-800 text-slate-400 hover:text-amber-400 transition-colors flex items-center justify-center flex-shrink-0">
                        <i class="fa-regular fa-lightbulb text-xs"></i>
                    </button>
                </div>

                <!-- ACCORDION DE DICA (OCULTO POR PADRÃO) -->
                <div id="dica-${exercicio.id}" class="hidden p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
                    <span class="font-bold flex items-center gap-1 mb-1">
                        <i class="fa-solid fa-lightbulb text-amber-400"></i> Dica de Execução:
                    </span>
                    ${exercicio.dica || 'Mantenha o foco na contração muscular e execute o movimento com cadência controlada.'}
                </div>

                <!-- CARGA ANTERIOR INDICADOR (SE HOUVER) -->
                ${ultimoRegistro ? `
                    <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <i class="fa-solid fa-clock-rotate-left text-slate-600"></i>
                        <span>Último registro: <b class="text-slate-400">${ultimoRegistro.peso} kg</b> com <b class="text-slate-400">${ultimoRegistro.repeticoes} reps</b> (${ultimoRegistro.data})</span>
                    </div>
                ` : ''}

                <!-- INPUTS: PESO (KG), REPETIÇÕES E BOTÃO DE CONCLUIR -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/60 items-end">
                    <div>
                        <label class="text-[11px] font-bold text-slate-400 block mb-1">Carga Total (kg)</label>
                        <div class="relative">
                            <input id="peso-${exercicio.id}" type="number" min="0" step="0.5" value="${cargaSugerida}" placeholder="Ex: 25" class="w-full bg-dark-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-gym-500 transition-colors">
                        </div>
                    </div>

                    <div>
                        <label class="text-[11px] font-bold text-slate-400 block mb-1">Repetições</label>
                        <div class="relative">
                            <input id="reps-${exercicio.id}" type="number" min="1" max="100" value="${repsSugerida}" placeholder="${exercicio.repeticoes}" class="w-full bg-dark-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-gym-500 transition-colors">
                        </div>
                    </div>

                    <div class="col-span-2 sm:col-span-1">
                        <button id="botao-${exercicio.id}" onclick="concluirExercicio('${exercicio.id}')" class="w-full h-[42px] bg-gradient-to-r from-gym-500 to-gym-600 hover:from-gym-400 hover:to-gym-500 text-dark-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-glow flex items-center justify-center gap-1.5 active:scale-95">
                            <i class="fa-solid fa-check"></i>
                            <span>Salvar Série</span>
                        </button>
                    </div>
                </div>

            </div>
        `;

        container.appendChild(card);
    });
}

function toggleDica(id) {
    const dicaEl = document.getElementById("dica-" + id);
    if (dicaEl) {
        dicaEl.classList.toggle("hidden");
    }
}


/* =====================================================
   CONCLUIR EXERCÍCIO / SÉRIE
===================================================== */
async function concluirExercicio(id) {
    const exercicio = treinos[treinoAtual].exercicios.find(item => item.id === id);
    if (!exercicio) return;

    const pesoInput = document.getElementById("peso-" + id);
    const repsInput = document.getElementById("reps-" + id);

    const peso = Number(pesoInput.value);
    const reps = Number(repsInput.value) || exercicio.repeticoes;

    if (isNaN(peso) || peso < 0 || pesoInput.value.trim() === "") {
        mostrarToast("Digite o peso utilizado no exercício.", "erro");
        pesoInput.focus();
        return;
    }

    exerciciosConcluidos[id] = true;

    // Calcular volume total da série
    const volumeSerie = Math.round(peso * reps);

    const agora = new Date();
    const registro = {
        id: Date.now(),
        data: agora.toLocaleDateString("pt-BR"),
        hora: agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' }),
        treino: treinos[treinoAtual].nome,
        letra: treinoAtual,
        exercicio: exercicio.nome,
        grupo: exercicio.grupo,
        peso: peso,
        repeticoes: reps,
        volume: volumeSerie
    };

    // ── SUPABASE INSERT ───────────────────────────────────
    // Inserir no banco remoto (retorna com _db_id para referência futura)
    if (typeof gymflowDB !== 'undefined') {
        const registroSalvo = await gymflowDB.inserirRegistro(registro);
        historico.unshift(registroSalvo);
    } else {
        historico.unshift(registro);
    }
    localStorage.setItem("gymflow_historico", JSON.stringify(historico));
    // ─────────────────────────────────────────────────────

    // Atualizar visual do card para concluído
    const card = document.getElementById("exercicio-" + id);
    const botao = document.getElementById("botao-" + id);

    if (card) {
        card.classList.remove("border-slate-800/90");
        card.classList.add("border-gym-500/60", "bg-gym-500/5", "shadow-glow");
    }

    if (botao) {
        botao.innerHTML = `<i class="fa-solid fa-check-double"></i> <span>Salvo (${peso}kg)</span>`;
        botao.classList.remove("from-gym-500", "to-gym-600", "text-dark-950");
        botao.classList.add("from-gym-700", "to-emerald-800", "text-white");
    }

    // Feedback sonoro e notificação
    tocarSom('sucesso');
    mostrarToast(`${exercicio.nome}: ${peso} kg × ${reps} reps salvo!`);

    // Iniciar descanso automático se configurado
    if (preferencias.autoTimer) {
        const tempoDescanso = exercicio.descanso || 60;
        iniciarTimerPreset(tempoDescanso);
    }

    atualizarProgresso();
    atualizarResumoDashboard();
    atualizarEstatisticasHistorico();
}


/* =====================================================
   ATUALIZAR PROGRESSO DO TREINO ATIVO
===================================================== */
function atualizarProgresso() {
    if (!treinoAtual) return;

    const total = treinos[treinoAtual].exercicios.length;
    const concluidos = Object.keys(exerciciosConcluidos).length;
    const porcentagem = Math.round((concluidos / total) * 100);

    const barra = document.getElementById("barraProgresso");
    const texto = document.getElementById("textoProgresso");
    const contador = document.getElementById("contadorExerciciosFeitos");

    if (barra) barra.style.width = porcentagem + "%";
    if (texto) texto.textContent = porcentagem + "%";
    if (contador) contador.textContent = `(${concluidos} de ${total} concluídos)`;

    if (porcentagem === 100) {
        if (texto) texto.textContent = "100% 🔥";
    }
}

function concluirTreinoCompleto() {
    const total = treinos[treinoAtual].exercicios.length;
    const concluidos = Object.keys(exerciciosConcluidos).length;

    // Calcular volume da sessão atual
    let volumeSessao = 0;
    const registrosHoje = historico.filter(h => h.letra === treinoAtual);
    registrosHoje.slice(0, concluidos).forEach(r => {
        volumeSessao += (r.volume || (r.peso * r.repeticoes));
    });

    const duracaoTexto = document.getElementById("duracaoSessao").textContent || "00:00";

    document.getElementById("resumoModalTempo").textContent = duracaoTexto;
    document.getElementById("resumoModalExercicios").textContent = `${concluidos}/${total}`;
    document.getElementById("resumoModalVolume").textContent = `${volumeSessao.toLocaleString('pt-BR')} kg`;

    // Abrir modal de celebração
    const modal = document.getElementById("modalTreinoConcluido");
    if (modal) {
        modal.classList.remove("hidden");
    }

    // Explosão de confetes se a biblioteca estiver carregada
    if (typeof confetti === "function") {
        confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
        });
    }

    tocarSom('sucesso');
}

function fecharModalTreinoConcluido() {
    const modal = document.getElementById("modalTreinoConcluido");
    if (modal) modal.classList.add("hidden");
    fecharTreino();
    mostrarPagina("inicio");
}


/* =====================================================
   CRONÔMETRO DE DESCANSO (REST TIMER MODAL & DOCK)
===================================================== */
function abrirModalTimer() {
    const modal = document.getElementById("modalTimer");
    if (modal) modal.classList.remove("hidden");
    atualizarDisplayTimer();
}

function fecharModalTimer() {
    const modal = document.getElementById("modalTimer");
    if (modal) modal.classList.add("hidden");
}

function setTimerDuration(segundos) {
    timerConfig.tempoTotal = segundos;
    timerConfig.tempoRestante = segundos;
    atualizarDisplayTimer();
    iniciarTimer();
}

function iniciarTimerPreset(segundos) {
    timerConfig.tempoTotal = segundos;
    timerConfig.tempoRestante = segundos;
    iniciarTimer();
    mostrarToast(`Descanso de ${segundos}s iniciado! ⏱️`, 'info');
}

function toggleTimer() {
    if (timerConfig.estaRodando) {
        pausarTimer();
    } else {
        iniciarTimer();
    }
}

function iniciarTimer() {
    if (timerConfig.intervalo) clearInterval(timerConfig.intervalo);
    timerConfig.estaRodando = true;

    // Atualizar botões de UI
    const btnPlay = document.getElementById("btnTimerPlayPause");
    const icone = document.getElementById("iconeTimerPlay");
    const texto = document.getElementById("textoTimerPlay");
    const estado = document.getElementById("timerEstadoTexto");

    if (btnPlay) {
        btnPlay.classList.remove("bg-gym-500");
        btnPlay.classList.add("bg-amber-500");
    }
    if (icone) {
        icone.className = "fa-solid fa-pause";
    }
    if (texto) texto.textContent = "Pausar";
    if (estado) estado.textContent = "Contando...";

    // Mostrar widget no topo do app
    const widget = document.getElementById("widgetTimerTopo");
    if (widget) widget.classList.remove("hidden");

    timerConfig.intervalo = setInterval(() => {
        if (timerConfig.tempoRestante > 0) {
            timerConfig.tempoRestante--;
            
            // Beep nos últimos 3 segundos
            if (timerConfig.tempoRestante <= 3 && timerConfig.tempoRestante > 0) {
                tocarSom('beep');
            }

            atualizarDisplayTimer();
        } else {
            // Timer Finalizado!
            finalizarTimer();
        }
    }, 1000);

    atualizarDisplayTimer();
}

function pausarTimer() {
    if (timerConfig.intervalo) {
        clearInterval(timerConfig.intervalo);
        timerConfig.intervalo = null;
    }
    timerConfig.estaRodando = false;

    const btnPlay = document.getElementById("btnTimerPlayPause");
    const icone = document.getElementById("iconeTimerPlay");
    const texto = document.getElementById("textoTimerPlay");
    const estado = document.getElementById("timerEstadoTexto");

    if (btnPlay) {
        btnPlay.classList.remove("bg-amber-500");
        btnPlay.classList.add("bg-gym-500");
    }
    if (icone) {
        icone.className = "fa-solid fa-play";
    }
    if (texto) texto.textContent = "Continuar";
    if (estado) estado.textContent = "Pausado";
}

function ajustarTimer(delta) {
    timerConfig.tempoRestante = Math.max(0, timerConfig.tempoRestante + delta);
    timerConfig.tempoTotal = Math.max(timerConfig.tempoTotal, timerConfig.tempoRestante);
    atualizarDisplayTimer();
}

function resetarTimer() {
    pausarTimer();
    timerConfig.tempoRestante = timerConfig.tempoTotal;
    const estado = document.getElementById("timerEstadoTexto");
    if (estado) estado.textContent = "Pronto";
    atualizarDisplayTimer();
}

function finalizarTimer() {
    pausarTimer();
    timerConfig.tempoRestante = 0;
    atualizarDisplayTimer();

    const estado = document.getElementById("timerEstadoTexto");
    if (estado) estado.textContent = "Tempo esgotado! 🔥";

    // Alerta sonoro e vibração se disponível no celular
    tocarSom('alerta');
    if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    mostrarToast("Tempo de descanso finalizado! Bora pra próxima série! 💪", "sucesso");

    // Esconder widget topo após 5s
    setTimeout(() => {
        const widget = document.getElementById("widgetTimerTopo");
        if (widget && !timerConfig.estaRodando) widget.classList.add("hidden");
    }, 5000);
}

function atualizarDisplayTimer() {
    const mins = String(Math.floor(timerConfig.tempoRestante / 60)).padStart(2, '0');
    const secs = String(timerConfig.tempoRestante % 60).padStart(2, '0');
    const formatado = `${mins}:${secs}`;

    const display = document.getElementById("timerDisplay");
    if (display) display.textContent = formatado;

    const widgetTexto = document.getElementById("tempoWidgetTopo");
    if (widgetTexto) widgetTexto.textContent = formatado;

    // Atualizar círculo SVG
    const circle = document.getElementById("timerProgressCircle");
    if (circle && timerConfig.tempoTotal > 0) {
        const totalCircunferencia = 264; // 2 * PI * 42
        const progresso = (timerConfig.tempoRestante / timerConfig.tempoTotal);
        const offset = totalCircunferencia * (1 - progresso);
        circle.style.strokeDashoffset = offset;
    }
}


/* =====================================================
   HISTÓRICO & FEED DE ATIVIDADES
===================================================== */
function mostrarHistorico() {
    const container = document.getElementById("listaHistorico");
    const inicio = document.getElementById("inicioHistorico");

    if (container) container.innerHTML = "";
    if (inicio) inicio.innerHTML = "";

    if (historico.length === 0) {
        const vazioHtml = `
            <div class="glass-card rounded-2xl p-7 text-center border border-slate-800">
                <div class="w-12 h-12 rounded-2xl bg-dark-850 flex items-center justify-center text-2xl mx-auto mb-3 text-slate-500">
                    <i class="fa-solid fa-chart-simple"></i>
                </div>
                <p class="text-white text-sm font-bold">Nenhum registro encontrado</p>
                <p class="text-slate-400 text-xs mt-1">Conclua seus exercícios para ver sua evolução aqui.</p>
                <button onclick="mostrarPagina('treinos')" class="inline-flex items-center gap-2 text-gym-400 font-bold text-xs mt-4 hover:underline">
                    Começar meu primeiro treino <i class="fa-solid fa-arrow-right text-[10px]"></i>
                </button>
            </div>
        `;

        if (container) container.innerHTML = vazioHtml;
        if (inicio) inicio.innerHTML = vazioHtml;
        return;
    }

    // Filtrar lista completa
    const registrosFiltrados = filtroHistoricoAtual === 'TODOS'
        ? historico
        : historico.filter(item => item.treino === filtroHistoricoAtual);

    if (container) {
        if (registrosFiltrados.length === 0) {
            container.innerHTML = `
                <div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-xs">
                    Nenhum registro para o ${filtroHistoricoAtual}.
                </div>
            `;
        } else {
            registrosFiltrados.forEach(registro => {
                container.appendChild(criarItemHistorico(registro, true));
            });
        }
    }

    // Feed da página inicial (3 últimos)
    if (inicio) {
        historico.slice(0, 3).forEach(registro => {
            inicio.appendChild(criarItemHistorico(registro, false));
        });
    }
}

function criarItemHistorico(registro, permitirExcluir = false) {
    const item = document.createElement("div");
    item.className = `
        glass-card-interactive rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 border border-slate-800/80
    `;

    const volume = registro.volume || (registro.peso * registro.repeticoes);

    item.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-gym-500/10 border border-gym-500/20 flex items-center justify-center text-gym-400 flex-shrink-0">
                <i class="fa-solid fa-check text-sm"></i>
            </div>

            <div class="min-w-0">
                <h5 class="font-bold text-white text-xs sm:text-sm truncate">
                    ${registro.exercicio}
                </h5>
                <div class="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span class="font-semibold text-gym-400">${registro.treino}</span>
                    <span>•</span>
                    <span class="truncate">${registro.grupo}</span>
                </div>
            </div>
        </div>

        <div class="flex items-center gap-3 flex-shrink-0">
            <div class="text-right">
                <p class="text-xs sm:text-sm font-black text-white">
                    ${registro.peso} kg <span class="text-slate-500 font-medium text-[11px]">× ${registro.repeticoes}</span>
                </p>
                <p class="text-[10px] text-slate-400">
                    ${registro.data} ${registro.hora ? '• ' + registro.hora : ''}
                </p>
            </div>

            ${permitirExcluir ? `
                <button onclick="excluirItemHistorico(${registro.id})" title="Excluir este registro" class="w-8 h-8 rounded-lg bg-dark-850 hover:bg-red-500/20 border border-slate-800 text-slate-500 hover:text-red-400 flex items-center justify-center transition-colors text-xs">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            ` : ''}
        </div>
    `;

    return item;
}

function filtrarHistoricoPorTreino(treino) {
    filtroHistoricoAtual = treino;

    // Atualizar botões de filtro
    const botoes = document.querySelectorAll(".filtro-hist-btn");
    botoes.forEach(b => {
        if (b.dataset.filtro === treino) {
            b.className = "filtro-hist-btn px-3 py-1 rounded-full text-xs font-bold bg-gym-500 text-dark-950 transition-all";
        } else {
            b.className = "filtro-hist-btn px-3 py-1 rounded-full text-xs font-semibold bg-dark-850 text-slate-400 hover:text-white border border-slate-800 transition-all";
        }
    });

    mostrarHistorico();
}

async function excluirItemHistorico(id) {
    // Encontrar o registro para obter o _db_id (ID do banco)
    const registro = historico.find(item => item.id === id || item._db_id === id);

    // ── SUPABASE DELETE ───────────────────────────────────
    if (typeof gymflowDB !== 'undefined' && registro) {
        const dbId = registro._db_id || registro.id;
        await gymflowDB.excluirRegistro(dbId);
    }
    // ─────────────────────────────────────────────────────

    historico = historico.filter(item => item.id !== id && item._db_id !== id);
    localStorage.setItem("gymflow_historico", JSON.stringify(historico));

    mostrarToast("Registro removido do histórico e da nuvem.", "info");
    mostrarHistorico();
    atualizarResumoDashboard();
    atualizarEstatisticasHistorico();
    renderizarGraficoEvolucao();
}

async function confirmarLimpezaHistorico() {
    if (historico.length === 0) {
        mostrarToast("Seu histórico já está vazio.", "info");
        return;
    }

    if (confirm("Tem certeza que deseja apagar todo o histórico de treinos? Essa ação não pode ser desfeita.")) {
        // ── SUPABASE DELETE ALL ───────────────────────────────
        if (typeof gymflowDB !== 'undefined') {
            await gymflowDB.limparHistorico();
        }
        // ─────────────────────────────────────────────────────

        historico = [];
        localStorage.removeItem("gymflow_historico");
        mostrarToast("Todo o histórico foi limpo com sucesso (local e nuvem).");
        mostrarHistorico();
        atualizarResumoDashboard();
        atualizarEstatisticasHistorico();
        renderizarGraficoEvolucao();
    }
}


/* =====================================================
   GRÁFICO DE EVOLUÇÃO (CHART.JS)
===================================================== */
function mudarModoGrafico(modo) {
    modoGrafico = modo;
    const btnPeso = document.getElementById("btnGraficoCarga");
    const btnVolume = document.getElementById("btnGraficoVolume");

    if (modo === 'peso') {
        btnPeso.className = "px-3 py-1.5 rounded-lg bg-gym-500 text-dark-950 font-bold transition-all";
        btnVolume.className = "px-3 py-1.5 rounded-lg text-slate-400 hover:text-white font-semibold transition-all";
    } else {
        btnVolume.className = "px-3 py-1.5 rounded-lg bg-cyan-500 text-dark-950 font-bold transition-all";
        btnPeso.className = "px-3 py-1.5 rounded-lg text-slate-400 hover:text-white font-semibold transition-all";
    }

    renderizarGraficoEvolucao();
}

function renderizarGraficoEvolucao() {
    const canvas = document.getElementById("graficoEvolucao");
    const msgVazio = document.getElementById("graficoVazioMsg");
    if (!canvas) return;

    if (historico.length === 0) {
        if (msgVazio) msgVazio.classList.remove("hidden");
        if (graficoInstancia) {
            graficoInstancia.destroy();
            graficoInstancia = null;
        }
        return;
    }

    if (msgVazio) msgVazio.classList.add("hidden");

    // Pegar os últimos 10 registros ordenados cronologicamente
    const dados = [...historico].slice(0, 10).reverse();

    const labels = dados.map(item => {
        const nomeCurto = item.exercicio.split(" ")[0];
        return `${nomeCurto} (${item.data.slice(0, 5)})`;
    });

    const valores = modoGrafico === 'peso'
        ? dados.map(item => item.peso)
        : dados.map(item => item.volume || (item.peso * item.repeticoes));

    const labelDataset = modoGrafico === 'peso' ? 'Carga (kg)' : 'Volume (kg × reps)';
    const corLinha = modoGrafico === 'peso' ? '#10b981' : '#06b6d4';
    const corFundo = modoGrafico === 'peso' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)';

    if (graficoInstancia) {
        graficoInstancia.destroy();
    }

    const ctx = canvas.getContext('2d');
    graficoInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: labelDataset,
                data: valores,
                borderColor: corLinha,
                backgroundColor: corFundo,
                borderWidth: 3,
                tension: 0.35,
                fill: true,
                pointBackgroundColor: corLinha,
                pointBorderColor: '#0c111d',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#0c111d',
                    titleColor: '#fff',
                    bodyColor: '#10b981',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4,
                    usePointStyle: true,
                    callbacks: {
                        label: function (context) {
                            const index = context.dataIndex;
                            const reg = dados[index];
                            return `${context.dataset.label}: ${context.raw} (${reg.exercicio} - ${reg.repeticoes} reps)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 10 }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 10 }
                    },
                    beginAtZero: false
                }
            }
        }
    });
}


/* =====================================================
   ESTATÍSTICAS & RESUMO
===================================================== */
function atualizarEstatisticasHistorico() {
    const total = historico.length;
    const maiorCarga = historico.length > 0
        ? Math.max(...historico.map(item => item.peso))
        : 0;

    const totalReps = historico.reduce((acc, item) => acc + Number(item.repeticoes || 0), 0);
    const totalVolume = historico.reduce((acc, item) => acc + (Number(item.volume) || (Number(item.peso) * Number(item.repeticoes))), 0);

    const elTotal = document.getElementById("historicoTotal");
    const elCarga = document.getElementById("historicoMaiorCarga");
    const elReps = document.getElementById("historicoReps");
    const elVolume = document.getElementById("historicoVolumeTotal");

    if (elTotal) elTotal.textContent = total;
    if (elCarga) elCarga.textContent = maiorCarga + " kg";
    if (elReps) elReps.textContent = totalReps.toLocaleString('pt-BR');
    if (elVolume) elVolume.textContent = totalVolume.toLocaleString('pt-BR') + " kg";
}

function atualizarResumoDashboard() {
    const totalRegistros = historico.length;
    const maiorCarga = historico.length > 0
        ? Math.max(...historico.map(item => item.peso))
        : 0;
    const totalVolume = historico.reduce((acc, item) => acc + (Number(item.volume) || (Number(item.peso) * Number(item.repeticoes))), 0);

    const elTreinos = document.getElementById("resumoTreinos");
    const elConcluidos = document.getElementById("resumoConcluidos");
    const elVolume = document.getElementById("resumoVolume");
    const elRecorde = document.getElementById("resumoRecorde");

    if (elTreinos) elTreinos.textContent = Object.keys(treinos).length;
    if (elConcluidos) elConcluidos.textContent = totalRegistros;
    if (elVolume) elVolume.textContent = totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}k kg` : `${totalVolume} kg`;
    if (elRecorde) elRecorde.textContent = `${maiorCarga} kg`;
}


/* =====================================================
   PERFIL, AVATAR & PREFERÊNCIAS
===================================================== */
function carregarPerfilUI() {
    const nomeEl = document.getElementById("inputNome");
    const pesoEl = document.getElementById("inputPesoCorporal");
    const alturaEl = document.getElementById("inputAltura");
    const metaEl = document.getElementById("selectMeta");

    const saudacao = document.getElementById("saudacaoInicio");
    const perfilNome = document.getElementById("nomePerfil");
    const headerNome = document.getElementById("nomeHeader");
    const avatarGrande = document.getElementById("perfilAvatarGrande");
    const avatarHeader = document.getElementById("avatarHeader");
    const metaDisplay = document.getElementById("metaPerfilDisplay");

    if (nomeEl) nomeEl.value = perfil.nome || "Atleta";
    if (pesoEl) pesoEl.value = perfil.pesoCorporal || "";
    if (alturaEl) alturaEl.value = perfil.altura || "";
    if (metaEl && perfil.meta) metaEl.value = perfil.meta;

    if (saudacao) saudacao.textContent = `Olá, ${perfil.nome || 'Atleta'}! 👋`;
    if (perfilNome) perfilNome.textContent = perfil.nome || "Atleta";
    if (headerNome) headerNome.textContent = perfil.nome || "Atleta";
    if (avatarGrande) avatarGrande.textContent = perfil.avatar || "🏋️";
    if (avatarHeader) avatarHeader.textContent = perfil.avatar || "🏋️";
    if (metaDisplay) metaDisplay.textContent = `Foco: ${perfil.meta || 'Hipertrofia & Força Muscular'}`;
}

async function salvarPerfil() {
    const inputNome = document.getElementById("inputNome");
    const inputPeso = document.getElementById("inputPesoCorporal");
    const inputAltura = document.getElementById("inputAltura");
    const selectMeta = document.getElementById("selectMeta");

    const novoNome = inputNome.value.trim();
    if (!novoNome) {
        mostrarToast("Digite seu nome ou apelido.", "erro");
        inputNome.focus();
        return;
    }

    perfil.nome = novoNome;
    perfil.pesoCorporal = inputPeso.value ? Number(inputPeso.value) : "";
    perfil.altura = inputAltura.value ? Number(inputAltura.value) : "";
    perfil.meta = selectMeta ? selectMeta.value : "Hipertrofia";

    // Salvar localmente
    localStorage.setItem("gymflow_perfil", JSON.stringify(perfil));
    localStorage.setItem("gymflow_nome", perfil.nome);

    // ── SUPABASE UPSERT PERFIL ────────────────────────────
    if (typeof gymflowDB !== 'undefined') {
        await gymflowDB.salvarPerfil(perfil);
    }
    // ─────────────────────────────────────────────────────

    carregarPerfilUI();
    tocarSom('sucesso');
    mostrarToast("Perfil atualizado e sincronizado! 👊");
}

function abrirSeletorAvatar() {
    const modal = document.getElementById("modalAvatar");
    if (modal) modal.classList.remove("hidden");
}

function fecharModalAvatar() {
    const modal = document.getElementById("modalAvatar");
    if (modal) modal.classList.add("hidden");
}

function selecionarAvatar(emoji) {
    perfil.avatar = emoji;
    localStorage.setItem("gymflow_perfil", JSON.stringify(perfil));
    carregarPerfilUI();
    fecharModalAvatar();
    mostrarToast(`Avatar alterado para ${emoji}!`);
}

function inicializarPreferenciasUI() {
    const chkSom = document.getElementById("chkSom");
    const chkAutoTimer = document.getElementById("chkAutoTimer");

    if (chkSom) chkSom.checked = preferencias.som;
    if (chkAutoTimer) chkAutoTimer.checked = preferencias.autoTimer;
}

function salvarPreferencia(chave, valor) {
    preferencias[chave] = valor;
    localStorage.setItem("gymflow_preferencias", JSON.stringify(preferencias));
    mostrarToast(`Preferência salva!`);
}


/* =====================================================
   EXPORTAÇÃO & COMPARTILHAMENTO DE DADOS
===================================================== */
function exportarRelatorioTexto() {
    if (historico.length === 0) {
        mostrarToast("Nenhum registro para exportar.", "info");
        return;
    }

    let texto = `🏋️ *RESUMO DE EVOLUÇÃO - GYMFLOW* 🚀\n`;
    texto += `Atleta: ${perfil.nome || 'Atleta'}\n`;
    texto += `Total de Registros: ${historico.length}\n`;
    
    const maiorCarga = Math.max(...historico.map(i => i.peso));
    texto += `Recorde Pessoal (PR): ${maiorCarga} kg\n\n`;
    texto += `*Últimos Treinos:* \n`;

    historico.slice(0, 5).forEach((item, index) => {
        texto += `${index + 1}. ${item.exercicio} (${item.treino}) - ${item.peso}kg × ${item.repeticoes} reps [${item.data}]\n`;
    });

    navigator.clipboard.writeText(texto).then(() => {
        tocarSom('sucesso');
        mostrarToast("Resumo copiado para a área de transferência!");
    }).catch(() => {
        mostrarToast("Erro ao copiar texto.", "erro");
    });
}

function exportarBackupJSON() {
    const dadosBackup = {
        versao: "2.0",
        dataExportacao: new Date().toISOString(),
        perfil: perfil,
        preferencias: preferencias,
        historico: historico
    };

    const blob = new Blob([JSON.stringify(dadosBackup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gymflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    mostrarToast("Backup exportado com sucesso!");
}

function importarBackupJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const dados = JSON.parse(e.target.result);
            if (dados.historico && Array.isArray(dados.historico)) {
                historico = dados.historico;
                localStorage.setItem("gymflow_historico", JSON.stringify(historico));
            }
            if (dados.perfil) {
                perfil = dados.perfil;
                localStorage.setItem("gymflow_perfil", JSON.stringify(perfil));
                localStorage.setItem("gymflow_nome", perfil.nome || "Atleta");
            }
            if (dados.preferencias) {
                preferencias = dados.preferencias;
                localStorage.setItem("gymflow_preferencias", JSON.stringify(preferencias));
            }

            carregarPerfilUI();
            inicializarPreferenciasUI();
            mostrarTreinos();
            mostrarHistorico();
            atualizarResumoDashboard();
            atualizarEstatisticasHistorico();
            renderizarGraficoEvolucao();

            mostrarToast("Dados importados com sucesso!", "sucesso");
        } catch (err) {
            mostrarToast("Arquivo de backup inválido.", "erro");
        }
    };
    reader.readAsText(file);
}