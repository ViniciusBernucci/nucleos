# Perfis de execução

Classifique cada tarefa no planejamento pelo comportamento e impacto, com justificativa e origem das decisões. O padrão é **padrao**. Ausência de informação não justifica **simples**. Escopo descoberto durante execução pode elevar o perfil; nunca reduza um gate para liberar falha.

| Perfil | Quando usar | Gates |
| --- | --- | --- |
| simples | Mudança localizada e reversível, sem alteração de contrato/API, regra de negócio, autenticação/autorização, dados, dependências ou infraestrutura compartilhada | Implementação + validação dos critérios; review completo independente. Auditoria se houver achados. O revisor verifica os critérios observáveis; QA separado somente se a experiência funcional exigir ambiente/cenários que o review não cobriu. |
| padrao | Feature/bug funcional com escopo e contratos conhecidos, sem gatilho crítico | Implementação; testes aplicáveis; aceite e review independente; auditoria se houver achados. Com risco explícito R0–R2, QA separado é condicional a lacunas/riscos sem cobertura. |
| critico | Permissões, autenticação, dados/migrations, operação destrutiva, exposição de segredo, contrato entre camadas, concorrência sensível ou infraestrutura de impacto amplo | Fluxo completo: implementação, review, auditoria independente mesmo sem achados, QA independente e validação integrada afetada. |

Uma mudança pequena pode ser crítica. Tarefa que altera contrato entre backend e frontend é crítica; ajustes independentes nas duas camadas não são automaticamente um contrato novo. O perfil do grupo integrado é o maior de seus membros; não reexecute gates individuais válidos.

## Fases condicionais

- Sem achados e com cobertura completa: auditoria em simples/padrao recebe **NA_SEM_ACHADOS**, vinculada ao relatório/SHA. Não abre sessão de auditor só para repetir “sem achados”. Limitação essencial bloqueia; não vira NA.
- R0–R2 explícitos: dispense sessão separada de QA apenas com todos os critérios essenciais demonstrados pelo revisor independente, testes determinísticos aplicáveis e evidência íntegra. Registre **COBERTO_NO_REVIEW**, checks e referências; isso significa QA_IA_DISPENSADO_POR_POLITICA, sem fabricar QA PASS. Se houver risco sem cobertura, registre require_qa e abra QA independente. O implementador nunca aprova sozinho. R3/R4 exigem revisor-de-qa independente.
- Achado, inclusive “precisa de validação” essencial: auditor independente antes de decidir correção. Correção e revalidação mantêm IDs, hashes e independência.
- Integração: revise interações/resoluções e execute cenários combinados afetados. Uma tarefa única sem novo comportamento de merge pode reaproveitar evidência idêntica, com comparação do conteúdo e justificativa; não basta SHA de merge diferente/igual. Crítico mantém validação integrada independente.
- Mantêm-se limites de três rodadas técnicas e três de QA por tarefa, isolamento, proteção de banco e proibição de push/PR/main.

## Planejamento proporcional

Simples: ticket curto (objetivo, critérios, arquivos, validação, fora do escopo), um estado e ponteiro do manifesto. Prompts operacionais por referência; não gere 00/99 repetindo o ticket. Padrao/critico: especificação única, prompts por camada e plano de integração somente com decisões específicas. Manifesto guarda referências, dependências e bases; não copia a especificação.

Planos legados mantêm perfil **critico** até classificação explícita com justificativa registrada. Não reescreva evidências históricas.

Declare `risk_level:R0|R1|R2|R3|R4` separado de `risk_factors`. Tarefas já persistidas sem risk_level conservam seus gates até migração/replanejamento explícito. Fatores críticos nunca podem ser classificados abaixo de R3 para dispensar QA. Consulte o protocolo V2 para o contrato e observabilidade para diagnóstico.
