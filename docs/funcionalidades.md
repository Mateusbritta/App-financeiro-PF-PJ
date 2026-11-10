# Funcionalidades

## Painel
Resumo do mês escolhido: receitas, despesas, saldo e **previsão após boletos** (saldo menos o que ainda vence no mês). Mostra gastos por categoria em pizza, alertas de limite e os próximos vencimentos. No espaço MEI, exibe também o faturamento do ano contra o limite.

## Boletos
- Cadastro manual ou pela **linha digitável** (valor e vencimento são preenchidos sozinhos).
- **Leitura do código de barras pela câmera**, feita no aparelho: nenhuma imagem é enviada.
- Boletos **recorrentes**, que mantêm o dia original do vencimento (um boleto do dia 31 volta ao 31 depois de fevereiro).
- Ao pagar, vira um lançamento de despesa; dá para desfazer o pagamento.

## Avisos de vencimento
Rotina diária (Vercel Cron) que avisa por **e-mail** (Resend) e **push** nos dias escolhidos por cada pessoa: 7, 3, 1 dia antes e no dia. Boletos vencidos há até 5 dias continuam sendo lembrados.

## Lançamentos
Entradas e saídas rápidas, com busca por descrição. A **categoria é sugerida** por regras e **aprende** quando você corrige uma categoria.

## Importação de extrato
Aceita **OFX** e **CSV**, categoriza as linhas e evita duplicar lançamentos.

## Limites por categoria
Defina um teto mensal por categoria de despesa. A barra de progresso muda de cor e o painel avisa a partir de 80%.

## Relatório mensal
Tabela e gráfico do mês, com exportação em **CSV** (abre no Excel) e **PDF** gerado no navegador. No celular, abre o menu de compartilhar.

## Módulo MEI
- **DAS** com vencimento no dia 20 (ajustado para fim de semana) e valor estimado.
- **Faturamento** do ano contra o limite do MEI.
- **Relatório de receitas brutas** e prazo da **DASN-SIMEI**.

## Equipe e espaços
- Convide cônjuge, funcionário ou contador por e-mail, como **administrador** ou **colaborador**.
- As telas atualizam **em tempo real** quando outro aparelho cadastra algo.
- Um login pode ter vários espaços (Pessoal e MEI) e alternar entre eles.

## PWA
Instalável na tela inicial do celular, com notificações push (no iPhone, primeiro "Adicionar à Tela de Início").
