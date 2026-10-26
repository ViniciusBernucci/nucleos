# ADR-023 — Provedor e modelo de autorização do object storage

- **Status:** Proposto (aceite depende do usuário; nenhuma decisão abaixo está aceita)
- **Data:** 2026-10-26
- **Decisores:** usuário (pendente)
- **Origem:** [ENT-DEC-009](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-009); [ADR consolidado, seção 10 "Storage"](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md); SEC-08 e T-F9-S/T/I do [threat model](../../seguranca/2026-10-25-threat-model-stride-por-fronteira.md); registro da entrega: [2026-10-26-dec-009-object-storage.md](../../dados/2026-10-26-dec-009-object-storage.md)

## Contexto

O ADR-008 reserva "armazenamento de objetos para arquivos". Cada tenant tem runtime, banco e rede próprios (ADR-002, ADR-003, ADR-014); falta decidir o provedor S3-compatível e **como a autorização impede que credencial ou URL do tenant A alcance objeto do tenant B** (SEC-08). Restrições herdadas: o runtime não recebe credencial de storage e pede URL ao Tool Gateway (ENT-DAT-006); segredos seguem o [ADR-020](0020-gestao-de-segredos-do-mvp.md) (arquivo, nunca ambiente); a identidade de serviço segue o [ADR-018](0018-identidade-de-servico-runtime-control-plane-gateways.md). Escopo do MVP: 1 VPS (24 GB de RAM de referência), 5 tenants.

## Problema

O provedor permite criar **bucket e credencial restrita ao bucket via API**, de forma automatizável pelo provisioner? Se sim, bucket por tenant; se não, bucket compartilhado com prefixo e somente o serviço de storage da plataforma assina URLs.

## Decisão

Proposta (a confirmar pelo usuário; itens em "Decisões humanas pendentes" no registro da entrega):

1. **Modelo de autorização: bucket por tenant (Modelo P)** com credencial restrita ao bucket, quando o provedor expõe API para criar bucket e chave escopada. Medido no PoC **somente no MinIO** (reconfirmar no provedor escolhido): A recebe `AccessDenied` ao ler, gravar, apagar e listar em B, inclusive para chave inexistente (sem oráculo de existência).
2. **A credencial do tenant fica só no serviço de storage da plataforma** (módulo do Control Plane/Tool Gateway, ENT-DAT-006), entregue como segredo classe (b) do ADR-020. **O runtime nunca recebe credencial de storage** nem URL com validade acima de 300 s; pede a URL ao Tool Gateway.
3. **Chave de objeto sempre construída pelo servidor** como `tenants/<tenant_id>/<departamento>/<document_id>/<nome-sanitizado>`, mesmo dentro de bucket dedicado, para manter o fallback (item 4) sem migração. Guardas executadas **antes** de qualquer chamada ao provedor: allowlist de `tenant_id` (a do ADR-020), `document_id` UUID, rejeição de `..`, `/` inicial, byte nulo, barra invertida, segmentos extras e chave de outro tenant (código de referência: [`politica.mjs`](../../../infrastructure/docker/poc-object-storage/politica.mjs)). `tenant_id` vem da identidade verificada, nunca do corpo da requisição.
4. **Fallback se o provedor não oferecer API de bucket/chave escopada ou o limite de buckets não couber:** bucket compartilhado com **credencial temporária por chamada e política de sessão restrita ao prefixo do tenant** (Modelo T, STS), quando o provedor suportar; senão chave por prefixo (Modelo S) e, em último caso, só assinatura pelo serviço com as guardas do item 3 (nesse caso a credencial da plataforma é ampla e as guardas são a única barreira).
5. **URL assinada:** TTL máximo 300 s (política do servidor; o S3 aceitaria até 7 dias), método fixado na assinatura, gerada **depois** da autorização no servidor e da conferência de `document_id` no banco do tenant.
6. **Revogação** (AC-2): (i) suspender a emissão de URLs para o tenant no serviço; (ii) apagar a chave do tenant no provedor; (iii) rodar o teste negativo (chave e URLs já emitidas devem falhar); (iv) emitir chave nova pelo fluxo de rotação do ADR-020 (janela dupla `current`/`previous`); (v) confirmar que B continua lendo e gravando. Medido **no MinIO** (reconfirmar no provedor escolhido; o teste negativo do passo (iii) é obrigatório por provedor): apagar a chave do usuário invalida **imediatamente** as URLs já assinadas por ela, sem esperar o TTL.
7. **Provedor para o MVP:** MinIO no próprio host (container) para desenvolvimento e como candidato ao MVP único-VPS, com a ressalva de que o backup precisa de **destino externo** (threat model T-F15-I, SEC-14). Para destino externo e produção com durabilidade gerenciada, B2 e R2 satisfazem o critério de chave restrita a bucket por API segundo a documentação (não exercitados; sem contas). A escolha entre eles e AWS S3 depende de região/LGPD e de custo, e **fica para decisão humana** (a PoC não prova nenhum provedor real).
8. **Versionamento e object lock** em buckets de backup. Medido no MinIO com a **credencial real do tenant** (política P: Get/Put/DeleteObject e ListBucket), rodada 1: em bucket com lock e retenção GOVERNANCE, o DELETE da versão retida é recusado, inclusive com o cabeçalho `x-amz-bypass-governance-retention` (falta permissão), e a versão segue legível; em bucket **só versionado**, o `DELETE` simples cria *delete marker*, **mas `s3:DeleteObject` basta para apagar uma versão específica de vez** (achado: versionamento sozinho não protege contra credencial de tenant comprometida; o object lock protege). O tenant também lê versões antigas por `versionId` com a política P. Decisão proposta: backup em bucket com object lock e credencial de escrita sem permissão de apagar/bypass, distinta da do tenant; o DELETE simples do tenant sobre o dado corrente (cria *delete marker*, versão preservada) fica como risco aceito a confirmar. **Criptografia em repouso:** medido SSE-S3 do MinIO com credencial `s3:*` (mede criptografia, não autorização): o texto não aparece no disco; controle positivo sem SSE aparece. TLS em trânsito **não** foi medido (PoC em loopback HTTP): obrigatório na implementação.

## Alternativas

| Alternativa | Por que foi considerada | Por que não foi escolhida |
| --- | --- | --- |
| Bucket compartilhado + prefixo + credencial por tenant (Modelo S) | Independe de limite de buckets; medido no MinIO: nega leitura/escrita/listagem alheia e a confusão de prefixo `a` x `ab` | Mais frágil: depende de política com condição `s3:prefix` correta por tenant; um erro de política expõe todos. Mantido como fallback |
| Credencial temporária por chamada com política de sessão (Modelo T) | Medido no MinIO: a política de sessão só reduz, a credencial derivada nega B, e remover o usuário-pai a invalida | Exige STS do provedor (MinIO tem; B2/R2 não verificados nesta tarefa); usuário-pai amplo é alvo crítico. Fallback preferido ao Modelo S |
| Só o serviço assina, credencial única ampla | Menos objetos no provedor | Um bug de chave expõe todos os tenants; sem defesa no provedor |
| Cloudflare R2 | Token por bucket via API; egresso gratuito | Documentação consultada não mostra escopo por prefixo; exige R2 contratado antes de criar token; região/LGPD a decidir |
| Backblaze B2 | Chave por bucket e `namePrefix` via `b2_create_key`; revogação por `b2_delete_key` | Limite de buckets e região/LGPD não verificados; transações Classe A/B/C gratuitas só na fonte do plano pay-as-you-go |
| AWS S3 | Maturidade (IAM, STS, Object Lock) | Preços não obtidos nesta tarefa (a página não renderizou as tabelas); IAM por tenant adiciona superfície |
| S3 do provedor da VPS | Proximidade | Não verificado se existe oferta S3-compatível |

## Benefícios

Barreira dupla: guarda no servidor (chave inválida nem chega ao provedor) e política no provedor (se a guarda falhar, o provedor nega). Revogação por tenant sem tocar nos demais. Runtime sem credencial de storage. Sem dependência de serviço pago no MVP.

## Trade-offs

- MinIO no host concentra dados e backup na mesma VPS; sem destino externo não há proteção contra perda do host.
- Bucket por tenant multiplica objetos de política/chave no provisioner (automação obrigatória, PRV-004) e esbarra em limites de buckets de alguns provedores (não verificados).
- MinIO é AGPLv3 e a imagem usada é de terceiro (Chainguard, `RELEASE.2026-10-23T20-06-51Z`); a política de distribuição das imagens oficiais da comunidade não foi verificada.
- `s3:ListAllMyBuckets` não é negado: o MinIO devolve 200 filtrado pelas permissões (A só enxerga o próprio bucket). Comportamento de outros provedores não medido.
- Presigned PUT não limita tamanho do corpo por si; cota e tamanho máximo exigem POST policy ou upload intermediado (DAT-006).

## Consequências

- DAT-006 implementa o serviço usando `politica.mjs` como referência de guardas e os testes do PoC como base do teste automatizado de SEC-08 (a ser reexecutado com SDK mantido, não com o cliente SigV4 caseiro do PoC).
- PRV-004 provisiona bucket + política + chave por tenant e grava a chave pelo broker do ADR-020.
- RAG-001 e o runtime consomem URLs via Tool Gateway; arquivos tratados como não confiáveis.
- Custos (5 tenants, premissas no registro da entrega): R2 ≈ US$ 1,35/mês e B2 ≈ US$ 0,70/mês de armazenamento+requisições para 100 GB; MinIO local usa o disco da VPS. Estimativas, não proposta comercial.
- Rodada 1 de correção (review/auditoria de DEC-009): ver o [registro](../../dados/2026-10-26-dec-009-object-storage.md). Licença AGPLv3, distribuição e *pin* de digest da imagem seguem adiados para a decisão humana sobre este ADR.
- Lacunas conhecidas: provedores reais não exercitados; TLS não medido; concorrência, multipart e limites de requisição não medidos; antimalware (DAT-006) não decidido.

## Quando revisar

Provedor sem API de bucket/chave escopada ou com limite de buckets abaixo do número de tenants; mudança de licença/distribuição do MinIO; exigência de região no Brasil; mais de 5 tenants ou mais de 1 TB; falha de qualquer teste negativo de SEC-08; cliente regulado que exija conta/bucket separado.

## Referências

- PoC e saída: [`infrastructure/docker/poc-object-storage/`](../../../infrastructure/docker/poc-object-storage/run-poc.sh), [saída real](../../dados/2026-10-26-dec-009-object-storage-saida-poc.txt) (execução original 73 OK; rodada 1: 83 OK, 0 FALHA).
- Fontes de provedores (consultadas em 2026-10-26): [R2 pricing](https://developers.cloudflare.com/r2/pricing/) (atualizada 2026-10-01), [R2 tokens](https://developers.cloudflare.com/r2/api/tokens/) (2026-10-01), [R2 limites](https://developers.cloudflare.com/r2/platform/limits/) (2026-06-08), [B2 pricing](https://www.backblaze.com/cloud-storage/pricing) (sem data na página), [B2 application keys](https://www.backblaze.com/docs/cloud-storage-application-keys) (2026-09-29), [AWS S3 pricing](https://aws.amazon.com/s3/pricing/) (tabelas não renderizadas).
- ADR-008, ADR-018, ADR-020; ENT-DAT-006; SEC-08, SEC-14.
