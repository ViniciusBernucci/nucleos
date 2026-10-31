# Runbooks

Procedimentos operacionais passo a passo (provisionar tenant, rotacionar segredo, restaurar backup, responder a incidente). Cada runbook deve declarar: objetivo, pré-requisitos, passos verificáveis, validação, rollback e contatos/responsáveis.

- Sem segredos ou dados reais nos exemplos.
- Procedimentos que tocam banco ou serviços reais exigem ambiente isolado declarado.

Estado: pasta criada pela tarefa FND-008.

- [Deploy e rollback de staging e producao por digest](deploy-staging-producao.md) (FND-006; ensaiado so em ambiente efemero).
