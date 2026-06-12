# Patrimo · Estruturador Patrimonial (mockup)

Mockup navegável de uma tela única para a plataforma **Patrimo** — otimização de
holdings patrimoniais para famílias com patrimônio relevante.

A tela compara a **estrutura patrimonial atual (AS-IS)** com a **estrutura
societária otimizada** proposta pelo motor de otimização, em um canvas
interativo estilo organograma societário.

## Como rodar

```bash
npm install
npm run dev      # abre o Vite em http://localhost:5173
npm run build    # build de produção
```

## O que está implementado

- **Toggle Atual ⇄ Otimizada** no header (decisão de layout escolhida).
- **Canvas interativo** com pan, zoom (botões / scroll / pinch) e **drag de nós**,
  via pointer events nativos — funciona com mouse **e toque (iPad)**.
- **Cadastro funcional 100% em memória** (`useState`, sem localStorage):
  adicionar entidades (PF, PJ, Imóvel, Investimento, Participação), editar,
  excluir, e **conectar** dois nós com aresta de **% de participação** editável.
- **Família Andrade pré-carregada** (casal + 2 filhos, 3 imóveis sendo 2 alugados,
  1 PJ operacional, carteira de investimentos) — a tela nunca abre vazia.
- **Painel Otimizado** derivado automaticamente: insere a **Holding** no topo da
  hierarquia (destaque dourado, a "estrela") e exibe **badges de economia
  tributária** nas arestas/nós:
  - **ITBI: imune** (integralização de imóveis)
  - **IR aluguel: −R$ x/mês** (PF → PJ, lucro presumido)
  - **ITCMD + inventário evitados** (doação de quotas com usufruto)
  - **IBS/CBS / IRPFM** (impactos da reforma tributária)
- **Rodapé comparativo** com carga recorrente AS-IS vs. Otimizada, economia anual
  e economia sucessória (one-time).

## Arquitetura

- **Entregável principal:** `src/EstruturadorPatrimonial.jsx` — componente único,
  `export default`, sem props obrigatórias. Todo o estado vive em memória.
- Scaffold mínimo Vite + React 18 + Tailwind v3 + lucide-react.

> Os parâmetros tributários (alíquotas de IR, ITBI, ITCMD etc.) são simplificados
> para fins de demonstração e ficam centralizados no topo do componente.
