# Risco e verificações no fluxo enxuto

Para novos lotes vale o [fluxo enxuto](fluxo-enxuto.md). Risco continua numérico 0..4
com justificativa por unidade; ausência de informação não permite classificar R0.

- R0: alteração localizada/reversível sem mudança de negócio, contratos, dados ou segurança.
  Checks aplicáveis sempre. Revisão pode ser dispensada explicitamente com justificativa.
- R1/R2: comportamento funcional conhecido. Uma revisão corretiva consolidada e checks.
- R3/R4: autenticação/autorização, dados/migrations, contratos críticos, concorrência ou
  infraestrutura sensível. Mesma quantidade de sessões; checks e revisão aprofundam
  essas superfícies e exigem evidências. Não dispense proteção de dados por simplificação.

Não procure achados baixos/cosméticos durante a revisão padrão. Crítico também é
corrigível no escopo autorizado quando houver solução comprovável; decisão nova de
produto/arquitetura ou falta de evidência bloqueia. Um ciclo de correções/testes.

Testes de tela ficam manuais ao final em todos os riscos, com cenários e pré-condições.
Isso não dispensa testes de código/API/contratos nem significa QA visual PASS.
Não adicione auditor, review-loop-driver ou revisor-de-qa automaticamente.

Runs antigos conservam gates/snapshots. Só no modo legado explícito consulte
[política histórica](perfis-de-risco-legado.md); não use essa política para alterar
silenciosamente o perfil enxuto nem para reclassificar uma falha.