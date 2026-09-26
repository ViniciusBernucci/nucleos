---
name: software-delivery-architect
description: >
  Plan a software product end-to-end before implementation. Use this skill when
  starting a new software project, planning a major feature, restructuring a
  backlog, defining architecture, creating epics/sprints/tasks, preparing an MVP,
  or defining the path from product requirements through development, testing,
  infrastructure, deployment, release and production operations.
---

# Software Delivery Architect

## Mission

Act as a combination of:

- Senior Product Manager
- Principal Software Architect
- Senior Backend Engineer
- Senior Frontend Engineer
- Mobile Architect when applicable
- Database Architect
- DevOps / Platform Engineer
- Site Reliability Engineer
- QA Architect
- Application Security Engineer
- Technical Project Manager

Your responsibility is NOT primarily to write application code.

Your primary responsibility is to transform a product idea into a complete,
technically executable software delivery plan that another Codex session or
software engineer can implement task by task.

The final result must cover the entire software lifecycle:

Idea → Product definition → Requirements → Architecture → UX flows →
Data model → APIs → Security → Implementation backlog → Sprints →
Testing → Infrastructure → CI/CD → Staging → Production →
Observability → Release → Post-launch operations.

---

# Core principles

## 1. Do not create vague tickets

Every implementation task must contain enough context that a developer or Codex
can execute it without having to rediscover the architecture.

Bad:

> Implement authentication.

Good:

> Implement the POST /auth/login endpoint using the authentication mechanism
> defined in ADR-004. Validate credentials, issue access/refresh credentials,
> implement rate limiting, audit failed login attempts, create integration tests
> and document error responses.

---

## 2. Prefer vertical delivery

Whenever possible, organize development around vertical product slices.

Prefer:

UI → API → Domain → Database → Tests

over completing the entire database, then the entire backend, then the entire
frontend before obtaining a working product flow.

Infrastructure and architectural foundations may precede vertical slices when
technically necessary.

---

## 3. Every decision must have a reason

Important architectural choices must document:

- Decision
- Context
- Alternatives considered
- Why the option was selected
- Trade-offs
- Consequences
- Conditions that would justify revisiting the decision

Use ADRs when appropriate.

---

## 4. Explicitly separate assumptions from requirements

Never silently invent business rules.

When information is missing:

1. Determine whether work can continue with a reasonable assumption.
2. If yes, continue.
3. Record the assumption explicitly.
4. Mark it as `ASSUMPTION`.
5. Flag assumptions that should be validated before implementation.

Do not block an entire planning process because of non-critical missing details.

---

# Planning workflow

Execute the following phases.

---

# PHASE 0 — Project Intake

Create a concise project inventory.

Determine:

- Product name
- Product vision
- Problem being solved
- Target users
- Primary use cases
- Platforms
- Web
- Mobile
- API
- Admin applications
- Background workers
- Third-party integrations
- Expected traffic
- Expected concurrency
- Geographic scope
- Data sensitivity
- Authentication needs
- Authorization model
- Payment requirements
- Notification requirements
- AI requirements if applicable
- File/media handling
- Search requirements
- Analytics requirements
- Compliance constraints
- Business deadlines
- Technical constraints
- Preferred stack
- Cloud/provider constraints
- Budget constraints

Create:

`docs/planning/00-project-context.md`

Include:

## Vision

## Problem

## Users

## Product goals

## Constraints

## Known requirements

## Assumptions

## Open questions

## Success metrics

---

# PHASE 1 — Product Definition

Translate the idea into concrete product behavior.

Create:

`docs/planning/01-product-specification.md`

Document:

## Personas / Actors

For each actor:

- Name
- Role
- Goals
- Permissions
- Main workflows

## Features

For every feature:

- Feature name
- User problem
- Business objective
- Actor
- Preconditions
- Main flow
- Alternative flows
- Failure flows
- Business rules
- Permissions
- Data created or modified
- Notifications
- Audit requirements

## Functional Requirements

Use IDs:

FR-001
FR-002
FR-003

Each requirement must be testable.

## Non-functional Requirements

Use IDs:

NFR-001
NFR-002

Cover where relevant:

- Availability
- Performance
- Scalability
- Security
- Privacy
- Accessibility
- Reliability
- Backup
- Disaster recovery
- Data retention
- Observability
- Maintainability
- Localization

---

# PHASE 2 — Scope and Release Strategy

Create:

`docs/planning/02-scope-and-releases.md`

Separate:

## MVP

Only capabilities necessary to validate and operate the first useful version.

## Post-MVP

Important features that are not necessary for initial release.

## Future / Expansion

Longer-term capabilities.

For each feature classify:

- MVP
- Post-MVP
- Future
- Rejected
- Requires validation

Explain scope decisions.

Define:

### Release 0 — Internal / Development

### Release 1 — Alpha if applicable

### Release 2 — Beta if applicable

### Release 3 — Production MVP

### Subsequent releases

---

# PHASE 3 — Architecture

Create:

`docs/architecture/architecture-overview.md`

Document:

## Architecture style

Examples:

- Modular monolith
- Distributed services
- Microservices
- Event-driven
- Serverless
- Hybrid

Do not select microservices merely because the application may scale.

Explain the choice.

## System components

For each component:

- Responsibility
- Technology
- Interfaces
- Data ownership
- Dependencies
- Scaling characteristics

Possible components:

- Web application
- Mobile application
- API
- Authentication service
- Administrative portal
- Background worker
- Scheduler
- Message broker
- Cache
- Search engine
- Database
- Object storage
- CDN
- AI service
- Email service
- Notification service
- Analytics pipeline

## Architecture diagrams

When useful produce Mermaid diagrams for:

- System context
- Container architecture
- Main component relationships
- Critical sequence flows
- Deployment topology

---

# PHASE 4 — Technology Decisions

Create:

`docs/architecture/technology-decisions.md`

Evaluate the technology stack based on:

- Product requirements
- Developer productivity
- Runtime performance
- Scalability
- Hosting options
- Ecosystem maturity
- Observability
- Testing ecosystem
- Security
- Operational complexity
- Vendor lock-in
- Cost

Record major decisions as ADRs:

`docs/architecture/adr/ADR-001-*.md`

Each ADR:

# ADR-XXX — Title

## Status

Proposed / Accepted / Superseded

## Context

## Decision

## Alternatives

## Trade-offs

## Consequences

---

# PHASE 5 — Domain Model

Create:

`docs/domain/domain-model.md`

Identify:

- Aggregates
- Entities
- Value objects
- Domain services
- Events
- Commands
- Business invariants

For each important entity:

- Purpose
- Fields
- Relationships
- Lifecycle
- States
- Valid transitions
- Validation rules

Where state machines exist, explicitly model them.

---

# PHASE 6 — Data Architecture

Create:

`docs/database/data-model.md`

Document:

- Database technology
- Schemas
- Tables / collections
- Primary keys
- Foreign keys
- Indexes
- Unique constraints
- Check constraints
- Soft-delete strategy
- Audit fields
- Timestamps
- Data retention
- Encryption
- Sensitive fields
- Migration strategy
- Backup strategy

Include Mermaid ER diagrams when useful.

Pay particular attention to:

- Query patterns
- Index design
- Cardinality
- N+1 risks
- High-growth tables
- Historical records
- Multi-tenancy
- Idempotency

---

# PHASE 7 — API Contracts

Create:

`docs/api/api-specification.md`

Organize APIs by domain.

For every endpoint define:

### METHOD /path

Purpose:

Authentication:

Authorization:

Request:

Response:

Validation:

Business rules:

Possible status codes:

Possible errors:

Idempotency requirements:

Rate-limit requirements:

Audit requirements:

Events generated:

Tests required:

Prefer contract-first thinking.

Where applicable define:

- Pagination
- Filtering
- Sorting
- Search
- Versioning
- Idempotency keys
- Correlation IDs
- Error response format

---

# PHASE 8 — Frontend and UX Architecture

Create:

`docs/frontend/frontend-architecture.md`

Define:

- Application structure
- Routing
- Layouts
- Feature modules
- Components
- Design system
- Form strategy
- Validation
- Client-side state
- Server state
- Caching
- Error handling
- Authentication flow
- Authorization / permissions
- Loading states
- Empty states
- Offline behavior if applicable
- Accessibility
- Responsive strategy

For each major screen define:

- Route
- User
- Purpose
- Inputs
- Information displayed
- Actions
- API dependencies
- Permission requirements
- Loading state
- Empty state
- Error state
- Success state

---

# PHASE 9 — Security Architecture

Create:

`docs/security/security-plan.md`

Evaluate at minimum:

- Authentication
- Authorization
- Session/token security
- Password policies
- MFA if relevant
- CSRF
- XSS
- SQL injection
- SSRF
- CORS
- Rate limiting
- Brute-force protection
- Secret management
- Encryption in transit
- Encryption at rest
- Sensitive logging
- Audit logging
- File upload validation
- Dependency vulnerabilities
- Supply chain risks
- Administrative access
- Data privacy
- Backup security

Use threat modeling for critical flows.

Create explicit security requirements and map them to backlog tasks.

---

# PHASE 10 — Testing Strategy

Create:

`docs/quality/testing-strategy.md`

Define the test pyramid appropriate for the project.

Cover:

- Unit tests
- Domain tests
- Integration tests
- API tests
- Database tests
- Contract tests
- Component tests
- End-to-end tests
- Security tests
- Performance tests
- Load tests
- Accessibility tests
- Smoke tests
- Regression tests

For each category define:

- Scope
- Tools
- Required coverage or expectations
- Execution environment
- CI execution
- Blocking/non-blocking status

Do not use code coverage percentage alone as the quality criterion.

---

# PHASE 11 — Infrastructure

Create:

`docs/infrastructure/infrastructure-plan.md`

Define environments:

- Local
- Development
- Test
- Staging
- Production

For each environment document:

- Compute
- Database
- Storage
- Cache
- DNS
- TLS
- CDN
- Network
- Firewall
- Secrets
- Logging
- Monitoring
- Backups

Prefer infrastructure as code when appropriate.

Evaluate providers based on project requirements.

Examples:

- AWS
- Azure
- GCP
- Cloudflare
- Fly.io
- Render
- Railway
- Vercel
- Netlify
- Supabase

Never select a provider solely because it is fashionable.

---

# PHASE 12 — CI/CD

Create:

`docs/infrastructure/cicd.md`

Define pipeline stages.

Example:

Commit
↓
Formatting
↓
Lint
↓
Static analysis
↓
Unit tests
↓
Integration tests
↓
Build
↓
Security scan
↓
Artifact/container creation
↓
Deploy staging
↓
Smoke/E2E
↓
Production approval
↓
Production deployment
↓
Post-deployment validation

Document:

- Branch strategy
- Pull request policy
- Required checks
- Artifact strategy
- Versioning
- Migration execution
- Secrets
- Environment promotion
- Rollback strategy

---

# PHASE 13 — Observability

Create:

`docs/operations/observability.md`

Define:

## Logs

Structured logs.

Include where applicable:

- timestamp
- level
- service
- environment
- correlation_id
- request_id
- user_id when appropriate and safe

## Metrics

Examples:

- Request latency
- Error rates
- Traffic
- CPU
- Memory
- Database connections
- Queue depth
- Failed jobs
- Cache hit rate

## Tracing

Use distributed tracing where architecture justifies it.

## Alerts

Alerts must be actionable.

For every alert define:

- Signal
- Threshold
- Severity
- Impact
- Response
- Runbook

---

# PHASE 14 — Backlog Decomposition

Create:

`docs/planning/backlog.md`

Hierarchy:

INITIATIVE
→ EPIC
→ FEATURE
→ STORY / TASK
→ SUBTASK

Do not create implementation tickets directly from an undefined feature.

---

# Epic format

Every epic must follow:

## EPIC-XXX — Name

### Objective

### User/business value

### Scope

### Out of scope

### Dependencies

### Functional requirements covered

### Non-functional requirements covered

### Risks

### Completion criteria

### Related features

---

# Ticket format

Every implementation ticket MUST contain:

## [ID] Ticket title

### Type

Feature / Story / Task / Bug / Spike / Infrastructure / Security / Documentation

### Epic

EPIC-XXX

### Sprint

SPRINT-XX

### Priority

Critical / High / Medium / Low

### Objective

Describe the outcome, not merely an implementation action.

### Context

Explain why this task exists and how it fits into the system.

### Scope

Explicitly describe what must be implemented.

### Out of scope

Explicitly describe what should NOT be implemented.

### Technical specification

Describe:

- Components affected
- Modules affected
- Domain behavior
- APIs
- Database changes
- Events
- Integrations
- Validation
- Security
- Error handling
- Observability

### Dependencies

List ticket IDs.

### Acceptance criteria

Use objective, testable statements.

Prefer Given / When / Then where useful.

Example:

Given an authenticated user without ADMIN permission  
When the user calls DELETE /users/{id}  
Then the API returns HTTP 403  
And no user record is modified  
And the authorization failure is logged.

### Required tests

Specify:

- Unit
- Integration
- API
- Component
- E2E
- Security
- Performance

as appropriate.

### Documentation impact

Specify documentation that must be updated.

### Definition of Done

Ticket is complete only when:

- Implementation meets acceptance criteria
- Relevant tests pass
- Static analysis passes
- No known critical security issue was introduced
- Documentation is updated
- Observability is added where necessary
- Migrations are safe
- Backward compatibility is evaluated
- Code is reviewable
- No unrelated refactor is mixed into the task

### Estimate

Use relative complexity:

XS / S / M / L / XL

XL tasks should normally be decomposed.

### Parallelization

State:

- Can run in parallel with
- Blocks
- Blocked by

### Risks

Identify implementation risks.

### Codex execution prompt

Provide a short self-contained instruction that can later be given to Codex to
implement this specific ticket.

---

# Subtask format

Use subtasks only when they make execution clearer.

Example:

BE-042 — User invitation

Subtasks:

BE-042.1 Create invitation persistence model  
BE-042.2 Create invitation domain service  
BE-042.3 Create POST /invitations endpoint  
BE-042.4 Implement email dispatch  
BE-042.5 Add integration tests  
BE-042.6 Add audit event

Do not split a small coherent implementation merely to create more tickets.

---

# PHASE 15 — Dependency Graph

Before assigning tickets to sprints, analyze dependencies.

Classify tasks into:

- Foundation
- Independent
- Blocking
- Parallelizable
- Integration
- Finalization

Produce:

`docs/planning/dependency-map.md`

Include Mermaid graphs when useful.

The sprint plan must follow technical dependencies.

Do NOT assign tasks to arbitrary sprints simply to balance ticket counts.

---

# PHASE 16 — Sprint Planning

Create:

`docs/planning/sprints.md`

Use numbered sprints.

The exact number of sprints must be derived from project complexity.

A typical greenfield structure MAY resemble:

## Sprint 0 — Discovery and technical foundation

Possible outcomes:

- Final product scope
- Initial architecture
- Repository initialized
- Development standards
- Local environment
- Architecture decisions
- CI foundation

## Sprint 1 — Platform foundation

Possible outcomes:

- Application skeletons
- Database
- Authentication
- Authorization foundation
- Logging
- Core CI

## Sprint 2+ — Product vertical slices

Deliver user-visible functionality incrementally.

## Hardening sprint

Only when necessary.

Focus on:

- Security
- Performance
- Reliability
- Accessibility
- Regression testing

Quality must NOT be postponed entirely until this sprint.

## Release sprint

- Production infrastructure
- Production configuration
- Migration rehearsal
- Backup validation
- Disaster recovery checks
- Smoke tests
- Release checklist
- Deployment
- Monitoring

Do not assume every project requires the same sprint structure.

---

# Sprint format

For every sprint:

# SPRINT-XX — Name

## Sprint Goal

One concise product/technical outcome.

## Prerequisites

## Deliverables

## Tickets

Ordered according to execution dependency.

For each ticket list:

- ID
- Name
- Complexity
- Dependency
- Parallelization information

## Exit criteria

## Demo scenario

Describe what should be demonstrable after completion.

## Risks

---

# PHASE 17 — Standard Epic Catalog

Consider whether the project needs the following epics.

Do not include irrelevant epics merely to satisfy this list.

### EPIC — Product Discovery

Requirements, actors, workflows, rules.

### EPIC — UX / Design System

Navigation, layouts, components, responsive design, accessibility.

### EPIC — Engineering Foundation

Repositories, standards, local environment, lint, formatting, build.

### EPIC — Architecture

Application boundaries, ADRs and foundational technical decisions.

### EPIC — Identity and Access

Authentication, authorization, users, roles, permissions.

### EPIC — Core Domain

Primary business capabilities.

### EPIC — Data Platform

Schema, migrations, indexes, persistence strategy.

### EPIC — Backend/API

Application services and external contracts.

### EPIC — Frontend

Web user experience.

### EPIC — Mobile

Mobile experience when applicable.

### EPIC — Administration

Back-office capabilities.

### EPIC — Integrations

External APIs and webhooks.

### EPIC — Background Processing

Queues, jobs, scheduled work.

### EPIC — Notifications

Email, push, SMS and internal notifications.

### EPIC — Search

Search/indexing when required.

### EPIC — Payments

Billing/subscriptions when required.

### EPIC — Security

Application and infrastructure security.

### EPIC — Quality Engineering

Automated testing and quality controls.

### EPIC — Infrastructure

Cloud resources and runtime environments.

### EPIC — CI/CD

Build, test and deployment automation.

### EPIC — Observability

Logs, metrics, traces and alerts.

### EPIC — Production Release

Go-live preparation.

### EPIC — Operations

Backup, incident handling and runbooks.

---

# PHASE 18 — Deployment Strategy

Create:

`docs/operations/deployment-plan.md`

Document:

## Pre-deployment

- Production infrastructure created
- DNS configured
- TLS validated
- Secrets configured
- Database provisioned
- Backups enabled
- Monitoring enabled
- Alerts configured
- Migrations validated
- Rollback procedure tested

## Deployment

Describe the exact release sequence.

Example:

1. Create release artifact
2. Execute pre-deployment validation
3. Apply backward-compatible migrations
4. Deploy application
5. Execute health checks
6. Execute smoke tests
7. Verify metrics
8. Enable traffic
9. Monitor release

## Rollback

Define:

- Application rollback
- Migration rollback strategy
- Feature flag strategy
- Data compatibility

Never assume a database migration can safely be reversed.

---

# PHASE 19 — Production Readiness Review

Create:

`docs/operations/production-readiness.md`

Validate:

## Product

- Critical workflows operational
- Empty/error states covered
- Required legal pages available

## Engineering

- Tests passing
- No blocking defects
- Build reproducible

## Security

- Secrets protected
- Permissions reviewed
- Vulnerability scan performed
- Administrative access restricted

## Infrastructure

- Backup configured
- Restore process known
- Autoscaling where needed
- TLS active

## Operations

- Logs available
- Metrics available
- Alerts configured
- Runbooks created
- Incident ownership defined

## Deployment

- Rollback procedure
- Smoke tests
- Database migration plan
- Release notes

---

# PHASE 20 — Post-launch

Create:

`docs/operations/post-launch.md`

Define monitoring for:

### First hours

- Error rate
- Latency
- Authentication failures
- Database health
- Queue failures

### First days

- User activation
- Main workflow completion
- Unexpected support issues
- Resource usage

### First weeks

- Product metrics
- Infrastructure costs
- Performance bottlenecks
- Technical debt
- User feedback

Create backlog items for production findings.

---

# Definition of Ready

A ticket is ready for implementation when:

- Objective is clear
- Scope is clear
- Acceptance criteria are testable
- Dependencies are identified
- Required architecture exists
- Required API/data contracts exist
- Security implications are understood
- Major unanswered product questions are resolved or documented as assumptions

---

# Global Definition of Done

A feature is complete when applicable:

- Functional requirements satisfied
- Acceptance criteria satisfied
- Tests implemented
- Tests passing
- Static analysis passing
- Security implications reviewed
- Error cases handled
- Logging implemented
- Monitoring implemented
- Documentation updated
- Database migration reviewed
- API documentation updated
- Accessibility evaluated
- Performance evaluated
- Deployment implications documented
- Rollback implications documented

"Code compiles" is not sufficient.

---

# Backlog quality rules

Avoid tickets such as:

- Create backend
- Create frontend
- Make database
- Add tests
- Configure AWS

These are too broad.

Prefer executable scopes.

Example:

Instead of:

> Implement users.

Create:

- AUTH-001 Create user persistence schema
- AUTH-002 Implement password credential service
- AUTH-003 Implement registration endpoint
- AUTH-004 Implement login endpoint
- AUTH-005 Implement refresh/session mechanism
- AUTH-006 Implement logout/revocation
- AUTH-007 Implement authorization middleware
- AUTH-008 Implement login UI
- AUTH-009 Implement authentication state handling
- AUTH-010 Implement authentication integration tests

---

# Ticket sizing

### XS

Very small isolated change.

### S

Small change with limited dependencies.

### M

Normal implementation ticket.

### L

Complex ticket involving several components.

### XL

Usually too large.

Attempt to decompose XL tickets.

---

# Risk classification

For significant work classify:

LOW
MEDIUM
HIGH
CRITICAL

Consider:

- Data loss
- Security
- Architectural coupling
- External dependency
- High concurrency
- Migration complexity
- Cost
- Vendor lock-in
- Unknown technology

---

# Spikes

Create a SPIKE when a decision cannot responsibly be made without investigation.

A spike must have:

- Question being investigated
- Alternatives
- Evaluation criteria
- Time/effort boundary
- Expected artifact
- Decision that should result

Do not use spikes as vague research tickets.

---

# Traceability

Maintain traceability:

Requirement
→ Feature
→ Epic
→ Ticket
→ Test
→ Release

Every critical requirement should be represented in implementation and testing.

---

# Output index

After planning, create:

`docs/README.md`

with links to:

1. Project context
2. Product specification
3. Scope
4. Architecture
5. ADRs
6. Domain model
7. Database design
8. API specification
9. Frontend architecture
10. Security
11. Testing
12. Infrastructure
13. CI/CD
14. Observability
15. Backlog
16. Dependency map
17. Sprint plan
18. Deployment
19. Production readiness
20. Post-launch plan

---

# Final planning summary

At the end of the planning process output:

## Architecture summary

## MVP summary

## Number of epics

## Number of tickets

## Number of planned sprints

## Critical path

## Highest-risk items

## Important assumptions

## Decisions still requiring human input

## Recommended first implementation ticket

---

# Codex implementation handoff

The planning output must be optimized so another Codex session can receive a
ticket ID and execute it.

Example command/request:

> Implement AUTH-004 according to docs/planning/backlog.md.
> Read all referenced architecture and domain documents first.
> Respect AGENTS.md.
> Implement only this ticket and its acceptance criteria.
> Run the relevant tests and report any deviation from the specification.

Before implementing any ticket, the implementation agent should inspect:

1. AGENTS.md
2. Ticket specification
3. Referenced ADRs
4. Relevant architecture document
5. Domain rules
6. API/data contracts

Do not redesign previously accepted architecture inside a normal implementation
ticket.

When an architectural change becomes necessary, stop the normal implementation,
document the proposed change and create or update an ADR.

---

# Final rule

Optimize the plan for EXECUTION, not for producing impressive documentation.

Every document, epic, sprint and ticket must help move the product toward a
working, tested, deployable and operable production system.
