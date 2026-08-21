const treinos = {
    A: {
        id: "A",
        nome: "Treino A",
        titulo: "Peito & Tríceps",
        descricao: "Foco em peitoral, tríceps e deltoide anterior",
        icone: "💪",
        tempoEstimado: "50 min",
        intensidade: "Alta",
        cor: "from-emerald-500 to-teal-700",
        corBadge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        exercicios: [
            {
                id: "supino-reto",
                nome: "Supino Reto com Barra",
                grupo: "Peitoral Maior",
                series: 4,
                repeticoes: 10,
                descanso: 90,
                dica: "Escápulas retraídas, pés firmes no chão e desça a barra na linha dos mamilos."
            },
            {
                id: "supino-inclinado",
                nome: "Supino Inclinado com Halteres",
                grupo: "Peitoral Superior",
                series: 3,
                repeticoes: 12,
                descanso: 75,
                dica: "Banco a 30°-45°. Amplitude máxima sem bater os halteres no topo."
            },
            {
                id: "crucifixo",
                nome: "Crucifixo no Banco Reto / Crossover",
                grupo: "Peitoral",
                series: 3,
                repeticoes: 12,
                descanso: 60,
                dica: "Cotovelos levemente flexionados durante todo o movimento. Sinta o alongamento."
            },
            {
                id: "triceps-pulley",
                nome: "Tríceps Corda no Pulley",
                grupo: "Tríceps",
                series: 3,
                repeticoes: 12,
                descanso: 60,
                dica: "Abra a corda no final da extensão e mantenha os cotovelos colados ao corpo."
            },
            {
                id: "triceps-frances",
                nome: "Tríceps Francês Unilateral",
                grupo: "Tríceps",
                series: 3,
                repeticoes: 10,
                descanso: 60,
                dica: "Controle a descida atrás da cabeça com o braço apontado para o teto."
            }
        ]
    },

    B: {
        id: "B",
        nome: "Treino B",
        titulo: "Costas & Bíceps",
        descricao: "Foco em dorsais, trapézio, bíceps e antebraço",
        icone: "🏋️",
        tempoEstimado: "55 min",
        intensidade: "Alta",
        cor: "from-blue-500 to-indigo-700",
        corBadge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        exercicios: [
            {
                id: "puxada-frontal",
                nome: "Puxada Frontal na Barra",
                grupo: "Dorsal",
                series: 4,
                repeticoes: 10,
                descanso: 90,
                dica: "Puxe com os cotovelos apontando para o chão e peito estufado."
            },
            {
                id: "remada-baixa",
                nome: "Remada Baixa no Triângulo",
                grupo: "Dorsal / Meio das Costas",
                series: 3,
                repeticoes: 12,
                descanso: 75,
                dica: "Mantenha a coluna ereta, aperte as escápulas ao puxar até o abdômen."
            },
            {
                id: "remada-curvada",
                nome: "Remada Curvada com Barra",
                grupo: "Costas Completo",
                series: 3,
                repeticoes: 10,
                descanso: 90,
                dica: "Tronco inclinado a 45°, core ativado e barra rente às pernas."
            },
            {
                id: "rosca-direta",
                nome: "Rosca Direta com Barra W",
                grupo: "Bíceps",
                series: 3,
                repeticoes: 10,
                descanso: 60,
                dica: "Não balance o tronco. Suba até a contração máxima e desça devagar."
            },
            {
                id: "rosca-martelo",
                nome: "Rosca Martelo com Halteres",
                grupo: "Braquial & Antebraço",
                series: 3,
                repeticoes: 12,
                descanso: 60,
                dica: "Pegada neutra (palmas voltadas uma para a outra). Ótimo para espessura do braço."
            }
        ]
    },

    C: {
        id: "C",
        nome: "Treino C",
        titulo: "Pernas Completas",
        descricao: "Foco em quadríceps, posteriores, glúteos e panturrilhas",
        icone: "🦵",
        tempoEstimado: "60 min",
        intensidade: "Extrema",
        cor: "from-amber-500 to-orange-700",
        corBadge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        exercicios: [
            {
                id: "agachamento",
                nome: "Agachamento Livre com Barra",
                grupo: "Quadríceps & Glúteos",
                series: 4,
                repeticoes: 10,
                descanso: 120,
                dica: "Pés na largura dos ombros, joelhos alinhados com a ponta dos pés e descida controlada."
            },
            {
                id: "leg-press",
                nome: "Leg Press 45°",
                grupo: "Quadríceps",
                series: 4,
                repeticoes: 12,
                descanso: 90,
                dica: "Pés no meio da plataforma, não tranque os joelhos na extensão total."
            },
            {
                id: "extensora",
                nome: "Cadeira Extensora",
                grupo: "Quadríceps",
                series: 3,
                repeticoes: 12,
                descanso: 60,
                dica: "Segure 1 segundo no pico de contração no topo antes de descer."
            },
            {
                id: "flexora",
                nome: "Mesa Flexora",
                grupo: "Posterior de Coxa",
                series: 3,
                repeticoes: 12,
                descanso: 60,
                dica: "Mantenha o quadril colado ao banco e contraia os posteriores."
            },
            {
                id: "panturrilha",
                nome: "Elevação de Panturrilha em Pé",
                grupo: "Panturrilha",
                series: 4,
                repeticoes: 15,
                descanso: 45,
                dica: "Alongue bem embaixo e suba o máximo na ponta dos pés com pausa de 1s."
            }
        ]
    },

    D: {
        id: "D",
        nome: "Treino D",
        titulo: "Ombros & Abdômen",
        descricao: "Foco em deltóides completo, trapézio superior e core",
        icone: "🔥",
        tempoEstimado: "45 min",
        intensidade: "Alta",
        cor: "from-purple-500 to-pink-700",
        corBadge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
        exercicios: [
            {
                id: "desenvolvimento",
                nome: "Desenvolvimento com Halteres",
                grupo: "Deltoide Anterior & Médio",
                series: 4,
                repeticoes: 10,
                descanso: 90,
                dica: "Banco a 75°-80°. Empurre os halteres para cima sem bater no topo."
            },
            {
                id: "elevacao-lateral",
                nome: "Elevação Lateral com Halteres",
                grupo: "Deltoide Lateral",
                series: 4,
                repeticoes: 12,
                descanso: 60,
                dica: "Cotovelos ligeiramente flexionados e eleve até a altura dos ombros."
            },
            {
                id: "elevacao-frontal",
                nome: "Elevação Frontal com Barra ou Halter",
                grupo: "Deltoide Anterior",
                series: 3,
                repeticoes: 12,
                descanso: 60,
                dica: "Controle absoluto do movimento, sem balançar o tronco."
            },
            {
                id: "abdominal",
                nome: "Abdominal Infra / Supra no Chão",
                grupo: "Abdômen",
                series: 3,
                repeticoes: 20,
                descanso: 45,
                dica: "Expire todo o ar no momento da contração para recrutar o transverso abdominal."
            },
            {
                id: "prancha",
                nome: "Prancha Isométrica",
                grupo: "Core / Abdômen",
                series: 3,
                repeticoes: 40,
                descanso: 60,
                dica: "Corpo em linha reta dos calcanhares à cabeça, glúteos e abdômen bem contraídos."
            }
        ]
    }
};

const motivacionais = [
    "A dor que você sente hoje será a força que você sentirá amanhã. 💪",
    "A disciplina é a ponte entre suas metas e suas conquistas. 🔥",
    "Mais um treino concluído, mais um passo rumo à sua melhor versão! ⚡",
    "O único treino ruim é aquele que não aconteceu. Vai pra cima! 🚀",
    "Consistência vence a motivação todos os dias. Mantenha o foco! 🎯",
    "Cada repetição conta. Supere seus limites hoje! 🏆"
];