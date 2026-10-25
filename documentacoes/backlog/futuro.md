# Fora desta parte — trabalho posterior

> Parte do [backlog](README.md). Não são tickets: são épicos candidatos para a **segunda parte**, a detalhar pelo Tech Lead quando a primeira parte tiver cumprido o gate. Evita-se detalhar agora o que depende de medições do MVP.

| Candidato | Origem | Gatilho / condição |
| --- | --- | --- |
| EP-F1 Multi-host e scheduler | ADR Entrega 6, Estágio 2 | Gatilhos de capacidade medidos em OBS-002 (RAM > 70–75%, backlog, latência) |
| EP-F2 Separar PostgreSQL e Control Plane em hosts próprios | ADR Estágio 2 | Idem; exigência contratual |
| EP-F3 HA de banco e failover comprovado, PITR | ADR Estágio 3, risco 1 | Requisito de disponibilidade contratual |
| EP-F4 Kubernetes/k3s e `K8sDriver` | ADR-010, Estágio 3 | Avaliação de custo/complexidade; > 20 tenants |
| EP-F5 Sandbox Executor (MicroVM/VM) para código, navegador, OCR, vídeo | ADR-013 | Demanda de produto que exija código arbitrário |
| EP-F6 Banco/host dedicado para clientes de risco elevado | ADR Entrega 6 | Exigência contratual/regulatória |
| EP-F7 Conectores reais (CRM, e-mail, redes sociais, Hotmart) e módulos de negócio | ADR 2.1; Especificação Mestra | Após gate; escopo de produto |
| EP-F8 Pagamento real (substituir simulador) | DEC-012 | Decisão comercial |
| EP-F9 Temporal ou orquestrador de workflows | DEC-007 | Gatilho registrado no ADR-021 |
| EP-F10 BYOK, modelos locais seletivos, múltiplos provedores de LLM | ADR tabela 3 | Custo/privacidade |
| EP-F11 SSO corporativo (OIDC/SAML) | DEC-002 | Demanda de clientes enterprise |
| EP-F12 Chaves por tenant / criptografia dedicada, secret manager (vault) | DEC-006, risco 9 | Exigência contratual |
