# 17 - Painel de dados com Server Components no Next.js

Criada em 2026-11-01. Última atualização: 2026-11-01. Exemplos validados com Node 24.22.2,
TypeScript 5.9.3 e Next.js 16.4.3. Python: não usado nesta lesson.

## Objetivo

Construir uma página de dashboard que busca dados **no servidor**, trata os quatro estados
(carregando, vazio, erro, sucesso), desenha um gráfico em SVG sem biblioteca e mantém segredos fora do
navegador.

**Pré-requisitos:** lessons [14](14%20-%20Estado%20deterministico%20de%20UI%20e%20fronteira%20de%20mocks%20no%20Next.js.md)
e [15](15%20-%20Temas%20claro%20e%20escuro%20com%20variaveis%20CSS%20no%20Next.js.md); noções de HTML/SVG.
**Posição na trilha:** bloco 6 (Next.js), depois dos temas.

## Modelo mental

No App Router, um componente é **Server Component** por padrão: roda só no servidor, pode ler arquivo e
chamar a API interna, e envia ao navegador apenas HTML. Por isso a chave de serviço (ambiente ou arquivo)
nunca chega ao cliente. Os filtros viram **parâmetros de URL** (`searchParams`) enviados por um
formulário `GET`: sem JavaScript no cliente, a página é recalculada no servidor a cada envio, e o
endereço fica compartilhável.

Gráfico simples = **função pura** (dados → coordenadas) + marcação SVG. A função pura é testável no
Node, sem navegador.

## Conexão com a implementação real

Entrega: [Painel de vendas Hotmart](../documentacoes/financeiro/2026-11-01-painel-de-vendas-hotmart.md).

| Conceito | Arquivo |
| --- | --- |
| Página e quatro estados | `apps/web/app/(app)/setores/financeiro/vendas/page.tsx` |
| Busca no servidor com chave em arquivo | `apps/web/lib/vendas-api.ts` |
| Funções puras (formato, variação, gráfico) | `apps/web/lib/vendas-formato.ts` + `apps/web/app/vendas-formato.test.ts` |
| Gráfico SVG + tabela acessível | `.../vendas/_components/GraficoReceita.tsx` |

## Do exemplo mínimo ao padrão do projeto

Exemplo mínimo executável (`node ex17.ts`): dados → geometria do gráfico.

```ts
import assert from "node:assert/strict";

interface Ponto {
  dia: string;
  centavos: number;
}

function teto(valor: number): number {
  if (valor <= 0) return 100;
  const exp = 10 ** Math.floor(Math.log10(valor));
  const f = valor / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

function geometria(serie: Ponto[], largura: number, altura: number) {
  const max = teto(Math.max(0, ...serie.map((p) => p.centavos)));
  const passo = serie.length > 1 ? largura / (serie.length - 1) : 0;
  const pontos = serie.map((p, i) => ({
    x: i * passo,
    y: altura - (p.centavos / max) * altura, // em SVG, y cresce para baixo
  }));
  return { max, polyline: pontos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") };
}

const g = geometria(
  [
    { dia: "2026-10-01", centavos: 0 },
    { dia: "2026-10-02", centavos: 5_000 },
    { dia: "2026-10-03", centavos: 2_500 },
  ],
  200,
  100,
);
assert.equal(g.max, 5_000);
assert.equal(g.polyline, "0.0,100.0 100.0,0.0 200.0,50.0");
```

Esqueleto do Server Component (**não executável isolado**: precisa do Next; mostra a forma):

```tsx
export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filtros = filtrosDaUrl(await searchParams); // valida; descarta o que não for esperado
  const r = await carregarPainel(filtros); // roda no servidor, com a chave de arquivo
  if (r.tipo === "nao-configurado") return <div className="state-box" role="status">…</div>;
  if (r.tipo === "erro") return <div className="state-box state-box--error" role="alert">…</div>;
  return <GraficoReceita painel={r.dados} />;
}
```

O padrão do projeto acrescenta: variação frente ao período anterior (nunca divide por zero), moeda e
fuso `America/Sao_Paulo`, cores só por *tokens* CSS (tema claro/escuro), tabela equivalente dentro de
`<details>` para leitores de tela, e rótulos de status em português com fallback para o valor original.

## Erros comuns e trade-offs

- Buscar no cliente com `useEffect` e expor a chave: viola o manual de front end. Busque no servidor.
- Repassar `searchParams` cru para a API: valide e **descarte** o que não for esperado (`filtrosDaUrl`).
- Cor como única informação: mostre também texto/ícone (▲/▼ e rótulo do status).
- Dividir por zero na variação percentual: trate "sem base no período anterior".
- Dinheiro em `float`: trafegue **centavos inteiros** e formate só na borda com `Intl.NumberFormat`.
- Quando **não** usar SVG manual: gráficos interativos (zoom, tooltips ricos) pedem biblioteca; para
  poucas séries estáticas, SVG no servidor é mais leve e acessível.

## Verificação

```bash
cd apps/web && node --test app/vendas-formato.test.ts
cd apps/web && node node_modules/next/dist/bin/next build   # a rota deve aparecer como dinâmica (ƒ)
```

## Exercícios

1. Em `geometria`, o que muda se a série tiver um único ponto? Ajuste o código para não dividir por zero.
2. Acrescente uma linha de média ao gráfico (uma `polyline` constante). Que função pura você criaria?
3. Por que o filtro de período usa `GET` e não `POST`? O que se perde e o que se ganha?
4. Troque o teto "redondo" por `Math.max(...)`. O que acontece com o eixo Y?

## Atualizacao por Server Action

Um filtro GET apenas escolhe quais dados locais mostrar. Para buscar dados novos na Hotmart,
o botao precisa executar uma operacao no servidor: o navegador envia o formulario para uma
Server Action, a action chama a API interna com a chave privada e so entao invalida a pagina.
O navegador nunca recebe o bearer. A pagina atualizada preserva os filtros da URL.

No arquivo actions.ts do painel, com os imports do proprio repositorio:

    "use server";
    import { revalidatePath } from "next/cache";
    import { executarAtualizacao, type EstadoAtualizacao } from "../../../../../lib/vendas-atualizacao.ts";
    export async function atualizarPainel(): Promise<EstadoAtualizacao> {
      const resultado = await executarAtualizacao();
      revalidatePath("/setores/financeiro/vendas");
      return resultado;
    }

O componente AtualizarVendas usa useActionState (React 19.3.1) para mostrar a espera e
desabilitar o botao durante o envio. As mensagens distinguem sucesso, falha, resultado
parcial, integracao desativada e outra sincronizacao em andamento. O POST aguarda o trabalho
terminar; o endpoint antigo 202 continua disponivel para disparo em segundo plano.
O timeout do cliente web e 180 segundos: se expirar, a execucao no servidor pode continuar.
Nao trate 202 como confirmacao de dados atualizados. Nao use GET para iniciar sincronizacao.

Teste com respostas simuladas e HTTP local, incluindo 401/503, corpo invalido e lock ocupado.
O web atual ainda nao possui autenticacao real por papel; esta action herda essa limitacao
do painel e exige manter a exposicao local. No produto autenticado, valide a sessao e a
permissao dentro da action, independentemente da visibilidade do botao.
Exercicio: por que revalidar antes do fim do POST pode mostrar numeros antigos?
Implementacao e validacoes: [entrega](../documentacoes/financeiro/2026-11-01-atualizacao-manual-hotmart.md).
