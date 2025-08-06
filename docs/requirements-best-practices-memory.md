# Software Requirements Best Practices Memory for Future Projects

## Critical Lessons Learned - Requirements Phase

### 1. **System Boundary Definition is CRITICAL**
**Memory**: Always clarify upfront whether you're building:
- A master data system vs. a management system that references master data
- A system that STORES opportunities vs. one that MANAGES selected opportunities
- This fundamental misunderstanding can invalidate entire requirements documents

**Best Practice**: Create a clear system context diagram showing:
- What data the system owns vs. what it references
- External systems and their relationship (source of truth vs. consumer)
- Data flow direction and synchronization patterns

### 2. **Multi-Tenant vs. Single-Tenant Decision Framework**
**Key Questions to Ask Early**:
- SaaS multi-tenant vs. dedicated deployments?
- Tenant data isolation requirements?
- Cross-tenant analytics needs?
- Tenant size variation expectations?

**Impact**: This decision affects database design, security model, deployment architecture, and pricing strategy.

### 3. **External API Integration Requirements Pattern**
**Always Document**:
- Rate limiting compliance strategy
- Authentication/authorization methods
- Error handling and retry logic
- Data mapping between external and internal schemas
- Change detection and conflict resolution
- Fallback strategies for API outages
- Cost implications of API usage

**Critical Pattern**: For systems that heavily depend on external APIs, create a dedicated "External Integration Requirements" section.

### 4. **Comprehensive RBAC Requirements Structure**
**Multi-Level Approach**:
- System-level roles (Admin, User, etc.)
- Tenant-level roles (Tenant Admin, Manager, etc.)  
- Object-level permissions (per opportunity project, per document)
- Action-level permissions (create, read, update, delete, export, sync)

**Memory**: Don't assume simple role hierarchies - government contracting needs granular, project-specific access control.

### 5. **Audit and Change Logging Requirements Pattern**
**5W Framework for Audit Logs**:
- **What**: Field-level change detection with before/after values
- **Who**: User identification and role at time of change
- **When**: Precise timestamp with timezone
- **Where**: System component, IP address, session info
- **Why**: Change reason categorization and trigger identification

**Memory**: Regulated industries need immutable audit trails with cryptographic integrity verification.

## Requirements Documentation Framework for Complex Projects

### 1. **Requirements Document Structure** 
```
1. Executive Summary (System Focus & Key Clarifications)
2. System Context & Boundaries (Critical for avoiding scope creep)
3. Functional Requirements
   3.1 Core Business Features
   3.2 External System Integration
   3.3 Data Management
4. Non-Functional Requirements
   4.1 Performance & Scalability
   4.2 Security & Compliance
   4.3 Integration & Interoperability
5. Technical Requirements
   5.1 Architecture Overview
   5.2 Database Design
   5.3 API Design
   5.4 UI/UX Requirements
6. Deployment & Operations
7. Testing & Validation
8. Risk Assessment
9. Success Criteria
```

### 2. **Critical Questions Framework**
**Before Writing Requirements, Answer**:

**Business Model Questions**:
- Multi-tenant SaaS or single-tenant deployments?
- How do users discover and select items to manage in the system?
- What's the user workflow handoff between different roles?
- What are the compliance and regulatory requirements?

**Technical Architecture Questions**:
- Which system is the source of truth for which data types?
- Real-time vs. batch synchronization requirements?
- Caching strategy for external data?
- Scalability expectations (users, data volume, API calls)?

**Integration Questions**:
- Which external systems provide data vs. consume data?
- How should conflicts between local and external data be resolved?
- What happens when external systems are unavailable?
- Who manages external API credentials and access?

### 3. **User Story Patterns for Complex B2B Systems**

**Government Contracting Opportunity Management Pattern**:
```
Epic: Opportunity Project Management
└── Story: As a business developer, I need to convert a SAM.gov opportunity into a trackable CRM project so that I can manage our pursuit activities
    └── Acceptance Criteria:
        - System imports opportunity data from external source
        - Creates internal project with persistent external link
        - Establishes polling configuration for updates
        - Assigns project to capture manager
        - Sets up document synchronization
└── Story: As a capture manager, I need to override external opportunity values while preserving source data so that I can track our internal estimates separately
└── Story: As a project team member, I need automatic notifications when external opportunity data changes so that I can assess impact on our pursuit strategy
```

**API Integration Pattern**:
```
Epic: External Data Synchronization
└── Story: As a system, I need to poll external APIs at configured intervals so that opportunity data stays current
└── Story: As a user, I need to see when external data changes so that I can take appropriate action
└── Story: As an administrator, I need to configure polling frequency per opportunity project so that I can balance data freshness with API costs
```

### 4. **Database Design Patterns for External Integration**

**Source Data + Local Management Pattern**:
```sql
-- External source configuration
external_sources (id, name, api_endpoint, auth_config)

-- Local managed entities that reference external data
managed_projects (id, external_source_id, external_id, local_config)

-- Versioned external data snapshots
external_data_snapshots (id, project_id, snapshot_time, raw_data, is_current)

-- Local overrides that preserve external values
local_overrides (id, project_id, field_name, external_value, override_value, reason)

-- Change tracking for external data
external_changes (id, project_id, change_time, changed_fields, impact_level)
```

### 5. **Requirements Traceability for Government Contracts**

**RTM Structure**:
```
Req-ID | Requirement | Source | Priority | Acceptance Criteria | Test Case | Implementation Status
REQ-001 | OAuth2 API Authentication | GovWin API Spec | High | Can authenticate and refresh tokens | TC-001 | Complete
REQ-002 | Opportunity Data Sync | Business Need | High | Data updates within 1 hour | TC-002 | In Progress
```

**Government Contracting Specific Traceability**:
- Link requirements to specific regulation citations (NIST, CMMC, FedRAMP)
- Trace security requirements to implementation and test cases
- Document compliance validation procedures

## Industry-Specific Requirements Patterns

### Government Contracting CRM
**Always Include**:
- CAGE code and DUNS number management
- Set-aside classification tracking (8(a), HUBZone, WOSB, etc.)
- NAICS code management and matching
- Security clearance requirements tracking
- Compliance with government data handling requirements

### Multi-Tenant SaaS Systems
**Core Requirements**:
- Tenant data isolation (logical vs. physical)
- Per-tenant customization capabilities
- Tenant onboarding automation
- Resource allocation and billing
- Cross-tenant analytics (if applicable)

### API-Heavy Integration Systems
**Essential Components**:
- API versioning strategy
- Rate limiting and cost management
- Circuit breaker patterns for external dependencies
- Data transformation and validation layers
- Monitoring and alerting for external services

## Tools and Templates for Future Projects

### Requirements Management Tools
- **Jira**: User stories, epics, and acceptance criteria
- **Confluence**: Documentation and collaboration
- **Lucidchart**: System context diagrams and data flow
- **Draw.io**: Technical architecture diagrams

### Government Contracting Specific Tools
- **NIST CSF**: Cybersecurity framework compliance tracking
- **CMMC Tools**: Cybersecurity maturity assessment
- **FedRAMP Templates**: Cloud security authorization

### Compliance Documentation Templates
- Requirements Traceability Matrix (RTM)
- Security Control Assessment templates
- Audit trail and change management procedures
- Risk assessment and mitigation plans

## Red Flags and Common Pitfalls

### 1. **Scope Creep Indicators**
- Requirements that mention "all opportunities" when building a management system
- Vague integration requirements without clear data ownership
- Missing external API cost analysis
- Undefined user workflow handoffs

### 2. **Technical Debt Risks**
- Assuming external APIs are always available
- Not planning for API version changes
- Inadequate error handling for external dependencies
- Missing data validation for external inputs

### 3. **Compliance Oversights**
- Not identifying all applicable regulations early
- Missing audit trail requirements
- Inadequate data classification and handling procedures
- Insufficient access control granularity

## Success Metrics for Requirements Phase

### Quality Indicators
- ✅ Clear system boundaries and data ownership
- ✅ Complete external integration specifications
- ✅ Comprehensive RBAC and audit requirements
- ✅ Detailed acceptance criteria for complex features
- ✅ Risk assessment with mitigation strategies

### Completeness Checklist
- [ ] System context diagram created and reviewed
- [ ] External API integration costs estimated
- [ ] Compliance requirements mapped to regulations
- [ ] User workflow documented end-to-end
- [ ] Performance and scalability requirements quantified
- [ ] Security model designed and documented
- [ ] Testing strategy defined for all requirement types

This memory document captures critical lessons learned and provides a framework for future projects to avoid common pitfalls and ensure comprehensive requirements documentation.