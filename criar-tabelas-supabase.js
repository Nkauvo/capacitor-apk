/**
 * GYMFLOW — Script de criação automática das tabelas no Supabase
 * 
 * COMO USAR:
 *   1. Instale o Node.js (já deve estar instalado)
 *   2. Abra o terminal na pasta do projeto
 *   3. Rode: node criar-tabelas-supabase.js
 * 
 * ALTERNATIVA MANUAL: Cole o SQL abaixo no SQL Editor do Supabase Dashboard
 */

const https = require('https');

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
const PROJECT_REF = 'arxugcqkubcxqsecvnfz';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeHVnY3FrdWJjeHFzZWN2bmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MTk5OTcsImV4cCI6MjEwNjQ5NTk5N30.H7oNro7veC5MYFFU5GnFEU-JYkIEEfD8EcSGZKI7PRo';
// ─────────────────────────────────────────────────────────────────────────────

// SQL de criação das tabelas (pode copiar e colar no SQL Editor do Supabase)
const SQL_CRIAR_TABELAS = `
-- ============================================================
-- GYMFLOW — Criação das Tabelas (executar no Supabase SQL Editor)
-- ============================================================

-- 1. Tabela de perfis de usuário (um perfil por dispositivo)
CREATE TABLE IF NOT EXISTS public.perfis (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       TEXT UNIQUE NOT NULL,
    nome            TEXT NOT NULL DEFAULT 'Atleta',
    avatar          TEXT DEFAULT '🏋️',
    peso_corporal   NUMERIC(5,1),
    altura          INTEGER,
    meta            TEXT DEFAULT 'Hipertrofia',
    nivel           TEXT DEFAULT 'Intermediário',
    atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela principal: histórico de treinos (INSERT/UPDATE/DELETE)
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

-- 3. Índices para performance de busca
CREATE INDEX IF NOT EXISTS idx_historico_device
    ON public.historico_treinos(device_id);

CREATE INDEX IF NOT EXISTS idx_historico_exercicio
    ON public.historico_treinos(exercicio);

CREATE INDEX IF NOT EXISTS idx_historico_criado
    ON public.historico_treinos(criado_em DESC);

-- 4. Habilitar acesso público com anon key (sem RLS por enquanto)
-- Isso permite que o app funcione sem autenticação por usuário
ALTER TABLE public.historico_treinos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis DISABLE ROW LEVEL SECURITY;

-- 5. Grant de acesso para a role anon (usada pela chave pública)
GRANT ALL ON public.historico_treinos TO anon;
GRANT ALL ON public.perfis TO anon;
GRANT USAGE ON SEQUENCE public.historico_treinos_id_seq TO anon;

-- 6. Habilitar Realtime na tabela de histórico
ALTER PUBLICATION supabase_realtime ADD TABLE public.historico_treinos;

-- Verificar se foi criado corretamente:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
`;

console.log('\n🏋️  GYMFLOW — Configuração do Banco de Dados Supabase');
console.log('═══════════════════════════════════════════════════════\n');

// Tentar criar via Management API (precisa de Management Token)
// Se não funcionar, mostrar instruções manuais
async function tentarCriarViaAPI() {
    return new Promise((resolve, reject) => {
        // A Management API do Supabase para executar SQL requer
        // um "Service Role Key" ou "Management Token" (não a anon key)
        // Vamos tentar via o endpoint de execução de função RPC
        const payload = JSON.stringify({ query: SQL_CRIAR_TABELAS });
        
        const options = {
            hostname: `${PROJECT_REF}.supabase.co`,
            path: '/rest/v1/rpc/exec_sql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function main() {
    try {
        console.log('📡 Verificando conexão com Supabase...');
        
        // Verificar se a tabela já existe
        const checkResult = await new Promise((resolve, reject) => {
            const options = {
                hostname: `${PROJECT_REF}.supabase.co`,
                path: '/rest/v1/historico_treinos?select=id&limit=1',
                headers: {
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`
                }
            };
            https.get(options, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            }).on('error', reject);
        });

        if (checkResult.status === 200) {
            console.log('✅ Tabela "historico_treinos" já existe! Nada a fazer.\n');
            console.log('🚀 Seu banco de dados já está configurado e pronto para uso!\n');
            return;
        }

        console.log('⚠️  Tabelas ainda não existem (esperado para projeto novo).\n');
        console.log('📋 EXECUTE O SQL ABAIXO NO SUPABASE SQL EDITOR:');
        console.log('   Acesse: https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new');
        console.log('─────────────────────────────────────────────────────────\n');
        console.log(SQL_CRIAR_TABELAS);
        console.log('\n─────────────────────────────────────────────────────────');
        console.log('📌 Passos:');
        console.log('   1. Acesse o link acima (SQL Editor do seu projeto)');
        console.log('   2. Cole todo o SQL acima na caixa de texto');
        console.log('   3. Clique em "Run" (▶ ou Ctrl+Enter)');
        console.log('   4. Aguarde a mensagem "Success"');
        console.log('   5. Volte ao app GymFlow e recarregue a página!\n');

    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

main();
