# Instalação e publicação

Guia completo para rodar o App Financeiro no seu computador e publicá-lo na Vercel.
Aplicativo web (instalável no celular como PWA) para **pessoa física** e **MEI**:

- Cadastro de **boletos** manual, com **leitura da linha digitável** (preenche valor e vencimento), **leitura do código de barras pela câmera do celular** e boletos recorrentes
- **Avisos de vencimento** por e-mail e por notificação no celular (7, 3, 1 dia antes e no dia — cada pessoa escolhe)
- **Lançamentos** rápidos de gastos e entradas, com **categoria sugerida automaticamente** (e que aprende com as suas correções)
- **Importação de extrato** do banco (OFX ou CSV)
- **Limites mensais por categoria** com barra de progresso e alerta aos 80%
- **Painel** com gráfico de pizza, previsão do mês e próximos vencimentos
- **Relatório mensal** com tabela e pizza, exportável em CSV (Excel) e PDF (gerado no próprio aparelho, com o gráfico; no celular abre o menu de compartilhar)
- **Módulo MEI**: DAS todo dia 20, faturamento contra o limite de R$ 81 mil, relatório de receitas brutas, prazo da DASN-SIMEI
- **Vários aparelhos / sócios**: mesmos dados em tempo real para quem for convidado, com papéis de administrador e colaborador
- Um mesmo login pode ter um espaço **Pessoal** e outro **MEI**, separados

> Fora desta versão (de propósito): integração com WhatsApp.

## Como rodar no seu computador

Você vai precisar de:

1. **Node.js 20.9 ou mais novo** — baixe em https://nodejs.org (versão LTS)
2. Uma conta gratuita no **Supabase** — https://supabase.com

### Passo a passo

**1. Banco de dados (Supabase)**

1. Crie um projeto novo no Supabase.
2. Abra **SQL Editor**, cole o conteúdo do arquivo `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie a *Project URL* e as chaves *anon* e *service_role*.
4. (Para testar rápido) Em **Authentication → Providers → Email**, desligue "Confirm email". Em produção, deixe ligado. Com ele desligado, convites não são aceitos: só entra num espaço por convite quem confirmou o e-mail pelo link enviado. Contas criadas enquanto a confirmação estava desligada também não aceitam convites depois.

> **Já tinha rodado o `schema.sql` antes de outubro/2026?** Rode também `supabase/migracao-2026-10.sql` no SQL Editor (pode rodar mais de uma vez). Sem ele, o painel do MEI e a rotina de avisos dão erro.

**2. Configurar o app**

Na pasta do projeto, abra um terminal e rode:

```bash
copy .env.example .env.local      # no Windows (PowerShell: Copy-Item .env.example .env.local)
npm install
```

Abra o `.env.local` e preencha ao menos `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.

**3. Iniciar**

```bash
npm run dev
```

Acesse http://localhost:3000, crie sua conta, escolha **Pessoal** ou **MEI** e pronto.

**Testes** (leitura de boleto, valores, datas, extrato e categorização):

```bash
npm test
```

## Avisos de vencimento

A rotina diária está em `src/app/api/cron/avisos/route.ts` e é agendada em `vercel.json` (todo dia às 8h de Brasília) quando o app estiver publicado na Vercel. Para testar localmente:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/cron/avisos
```

- **E-mail**: crie uma conta em https://resend.com, gere uma chave e coloque em `RESEND_API_KEY`. Sem domínio próprio, o Resend só envia para o e-mail do dono da conta; para enviar a outras pessoas, verifique um domínio e ajuste `EMAIL_FROM`.
- **Avisos push**: gere as chaves com `npx web-push generate-vapid-keys` e preencha `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`. Depois, em **Configurações → Ativar avisos neste aparelho**. No iPhone, primeiro "Adicionar à Tela de Início". Ativar e desativar vale só para o aparelho em uso: cada celular ou computador é ligado separadamente.

## Publicar (grátis para começar)

1. Suba a pasta para um repositório no GitHub.
2. Em https://vercel.com, importe o repositório e cadastre as mesmas variáveis do `.env.local` (troque `NEXT_PUBLIC_APP_URL` pelo endereço final).
3. No Supabase, em **Authentication → URL Configuration**, coloque o endereço do app em *Site URL*.

## Pontos para conferir

- **Valores do MEI** ficam em `src/lib/das.ts` (`SALARIO_MINIMO` e `LIMITE_MEI`). Confira todo início de ano no Portal do Empreendedor — o valor do DAS exibido é uma **estimativa**.
- O vencimento do DAS considera o dia 20 e fins de semana, **não** feriados. Todo boleto que vence no sábado ou domingo só aparece como vencido depois da segunda-feira.
- A **leitura pela câmera** só funciona em endereço seguro: `https://` (Vercel) ou `http://localhost`. Pelo endereço da rede local (`http://192.168...`) o navegador bloqueia a câmera. A leitura é feita no aparelho; nenhuma imagem é enviada.
- O **MEI não admite sócios**: o acesso compartilhado serve para o titular dar acesso a cônjuge, funcionário ou contador.
- Dados financeiros são sensíveis: mantenha a confirmação de e-mail ligada em produção e nunca publique a chave `service_role`.

## Estrutura

```
supabase/schema.sql          banco, regras de segurança (RLS) e funções
supabase/migracao-2026-10.sql  atualização para bancos criados antes de outubro/2026
src/app/(app)/               telas: painel, boletos, lançamentos, limites, relatório, importar, MEI, configurações
src/app/actions.ts           todas as ações de gravação (servidor)
src/app/api/cron/avisos      rotina diária de avisos
src/lib/                     leitura de boleto, categorização, DAS, importação OFX/CSV (testes em lib.test.ts)
public/sw.js                 service worker dos avisos push
```

## Próximos passos sugeridos

1. Anexar comprovantes e notas fiscais (Supabase Storage)
2. Leitura de boleto por foto/PDF
3. Metas de economia e controle de parcelas
4. Integração com WhatsApp

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Erro ao abrir o app, "Invalid API key" ou tela em branco | `.env.local` incompleto ou com chaves trocadas | Confira `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`; reinicie o `npm run dev` |
| Erro de tabela ou função inexistente | `schema.sql` não foi executado | Rode `supabase/schema.sql` no SQL Editor; em banco antigo, rode também a migração |
| Painel do MEI ou avisos dão erro | Falta a migração de outubro/2026 | Rode `supabase/migracao-2026-10.sql` |
| Não recebo o e-mail de confirmação | Provedor de e-mail do Supabase limitado | Para testar, desligue "Confirm email"; em produção, configure um SMTP |
| Câmera não abre | Endereço não seguro | Use `https://` (Vercel) ou `http://localhost`, nunca o IP da rede |
| Avisos não chegam | `CRON_SECRET`, Resend ou VAPID ausentes | Preencha as variáveis na Vercel e teste a rota do cron com `curl` |
| Primeira abertura demora | Partida a frio do plano gratuito da Vercel | Normal; ajuste `regions` no `vercel.json` para perto do seu Supabase |
