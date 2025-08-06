# PostgreSQL Data Model - GWM CRM

---

## TABLE OF CONTENTS

### 1. DATA MODEL OVERVIEW
- System Architecture Context
- Multi-Tenant Strategy
- Key Design Principles

### 2. CORE ENTITIES
- Tenant Management
- User Management & RBAC
- Opportunity Project Management
- External Data Integration
- Document Management

### 3. ADVANCED ENTITIES
- Workflow & Activity Management
- Audit & Change Tracking
- API Integration & Polling
- Analytics & Reporting

### 4. DATABASE SCHEMA DEFINITIONS
- Complete SQL Schema
- Indexes and Performance Optimization
- Constraints and Data Integrity

### 5. FILE MANAGEMENT STRUCTURE
- Document Storage Strategy
- File Organization & Versioning
- Security & Access Control

### 6. PERFORMANCE & SCALING CONSIDERATIONS
- Multi-Tenant Data Isolation
- Query Optimization
- Archiving & Retention

---

## 1. DATA MODEL OVERVIEW

### System Architecture Context

This PostgreSQL data model supports a **multi-tenant SaaS** opportunity management CRM system with the following key characteristics:

- **500+ concurrent users per tenant**
- **1000+ opportunity projects per tenant**  
- **FedRAMP compliance** with comprehensive audit trails
- **Version-based conflict resolution** for external data synchronization
- **Internal API integration** (not third-party external APIs)
- **Enterprise-scale document management**

### Multi-Tenant Strategy

**Logical Separation (Shared Database)**
- Single database with tenant_id isolation
- Row-level security (RLS) for data isolation
- Shared infrastructure with logical boundaries
- Cost-effective and easier to maintain than database-per-tenant

### Key Design Principles

1. **FedRAMP Compliance**: Complete audit trails and data protection
2. **Version History**: No data loss - complete change tracking
3. **Performance**: Optimized for enterprise scale (500+ users, 1000+ projects)
4. **Data Integrity**: Strong referential integrity and constraints
5. **Scalability**: Designed for horizontal and vertical scaling
6. **Security**: Multi-level access control and encryption support

---

## 2. CORE ENTITIES

### 2.1 Tenant Management

```sql
-- Core tenant management for multi-tenant SaaS
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    plan_type VARCHAR(50) NOT NULL, -- starter, professional, enterprise
    max_users INTEGER NOT NULL DEFAULT 100,
    max_opportunity_projects INTEGER NOT NULL DEFAULT 500,
    is_active BOOLEAN NOT NULL DEFAULT true,
    fedramp_compliant BOOLEAN NOT NULL DEFAULT false,
    
    -- Billing and subscription
    subscription_status VARCHAR(50) DEFAULT 'trial', -- trial, active, suspended, cancelled
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    billing_email VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Tenant configuration for customization
CREATE TABLE tenant_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    config_type VARCHAR(50) NOT NULL, -- ui_settings, workflow_config, integration_settings
    is_encrypted BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, config_key)
);
```

### 2.2 User Management & RBAC

```sql
-- Users with comprehensive RBAC
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Authentication
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255), -- NULL if SAML-only user
    is_saml_user BOOLEAN DEFAULT false,
    saml_id VARCHAR(255),
    
    -- Profile
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(150),
    phone VARCHAR(50),
    avatar_url VARCHAR(500),
    
    -- Account status
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret_encrypted TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    
    UNIQUE(tenant_id, email)
);

-- Role-based access control
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, name)
);

-- User role assignments
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    
    -- Optional project-level role assignments
    opportunity_project_id UUID REFERENCES opportunity_projects(id) ON DELETE CASCADE,
    
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, role_id, COALESCE(opportunity_project_id, '00000000-0000-0000-0000-000000000000'::UUID))
);
```

### 2.3 External Data Source Management

```sql
-- External data sources (our internal API endpoints)
CREATE TABLE external_opportunity_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    source_name VARCHAR(100) NOT NULL, -- "Company Platform API v1", etc.
    api_endpoint VARCHAR(500) NOT NULL,
    api_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    
    -- Authentication (per-tenant for FedRAMP compliance)
    authentication_type VARCHAR(50) NOT NULL, -- api_key, oauth2, basic_auth
    api_credentials_encrypted JSONB NOT NULL, -- encrypted credentials
    
    -- Rate limiting and performance
    rate_limit_per_hour INTEGER DEFAULT 1000,
    timeout_seconds INTEGER DEFAULT 30,
    retry_attempts INTEGER DEFAULT 3,
    
    -- Status and health
    is_active BOOLEAN DEFAULT true,
    connection_status VARCHAR(50) DEFAULT 'unknown', -- healthy, degraded, down, unknown
    last_successful_call TIMESTAMP WITH TIME ZONE,
    last_error_message TEXT,
    consecutive_errors INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    
    UNIQUE(tenant_id, source_name)
);
```

### 2.4 Opportunity Project Management

```sql
-- Core opportunity projects (selected opportunities being pursued)
CREATE TABLE opportunity_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Project identification
    project_name VARCHAR(255) NOT NULL,
    internal_reference_number VARCHAR(100),
    
    -- External source linkage
    external_source_id UUID NOT NULL REFERENCES external_opportunity_sources(id),
    external_opportunity_id VARCHAR(255) NOT NULL, -- ID in external system
    external_opportunity_url VARCHAR(1000),
    
    -- Basic opportunity data (synced from external source)
    solicitation_number VARCHAR(100),
    agency_name VARCHAR(255),
    contracting_office VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    
    -- Project management
    project_status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, on_hold, cancelled, completed, archived
    pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'phase_0', -- phase_0 through phase_6, awarded, lost
    priority_level VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    
    -- Scoring and assessment
    win_probability_score DECIMAL(5,2), -- 0.00 to 100.00
    strategic_value_score DECIMAL(5,2), -- 0.00 to 100.00
    pursuit_health_score DECIMAL(5,2), -- calculated field
    
    -- Team assignments
    assigned_capture_manager UUID REFERENCES users(id),
    assigned_proposal_manager UUID REFERENCES users(id),
    assigned_team_members JSONB DEFAULT '[]', -- array of user IDs
    
    -- Synchronization tracking
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'pending', -- pending, syncing, synced, error
    sync_error_message TEXT,
    version_hash VARCHAR(64), -- for change detection
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    
    UNIQUE(tenant_id, external_source_id, external_opportunity_id)
);

-- Versioned external opportunity data (complete history)
CREATE TABLE external_opportunity_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_project_id UUID NOT NULL REFERENCES opportunity_projects(id) ON DELETE CASCADE,
    
    -- Version tracking
    data_snapshot_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    version_number INTEGER NOT NULL,
    is_current_version BOOLEAN DEFAULT true,
    
    -- Opportunity details from external source
    title VARCHAR(500),
    description TEXT,
    opportunity_type VARCHAR(100),
    set_aside_type VARCHAR(100),
    naics_codes VARCHAR(200),
    estimated_value_min DECIMAL(15,2),
    estimated_value_max DECIMAL(15,2),
    posting_date DATE,
    response_due_date TIMESTAMP WITH TIME ZONE,
    place_of_performance TEXT,
    
    -- Status and amendments
    solicitation_status VARCHAR(50),
    amendment_number INTEGER DEFAULT 0,
    
    -- Complete external data payload
    raw_json_data JSONB NOT NULL,
    
    -- Change tracking
    change_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_fields JSONB, -- array of field names that changed
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Local overrides for opportunity project data
CREATE TABLE opportunity_project_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_project_id UUID NOT NULL REFERENCES opportunity_projects(id) ON DELETE CASCADE,
    
    field_name VARCHAR(100) NOT NULL,
    original_external_value JSONB,
    override_value JSONB NOT NULL,
    override_reason TEXT,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    
    UNIQUE(opportunity_project_id, field_name)
);
```

### 2.5 Contact and Organization Management

```sql
-- Organizations (government agencies, contractors, partners)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic information
    name VARCHAR(255) NOT NULL,
    duns_number VARCHAR(13),
    sam_unique_id VARCHAR(50),
    cage_code VARCHAR(10),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United States',
    
    -- Contact information
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(500),
    
    -- Business classification
    organization_type VARCHAR(100), -- government_agency, prime_contractor, subcontractor, partner
    business_size VARCHAR(50), -- small, large, 8a, hubzone, wosb, etc.
    socioeconomic_certifications JSONB DEFAULT '[]',
    
    -- Hierarchy
    parent_organization_id UUID REFERENCES organizations(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Contacts within organizations
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    
    -- Personal information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),
    
    -- Classification
    contact_type VARCHAR(50), -- government_poc, technical_poc, contracting_officer, decision_maker, influencer
    decision_maker_level INTEGER, -- 1-5 scale of influence
    security_clearance VARCHAR(50),
    
    -- Interaction tracking
    last_contact_date DATE,
    interaction_frequency VARCHAR(50), -- never, rare, occasional, frequent, regular
    relationship_strength INTEGER, -- 1-5 scale
    
    -- Notes and tags
    notes TEXT,
    tags JSONB DEFAULT '[]',
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Opportunity project to contact relationships
CREATE TABLE opportunity_project_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_project_id UUID NOT NULL REFERENCES opportunity_projects(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    relationship_type VARCHAR(50), -- government_poc, technical_evaluator, decision_maker, contracting_officer
    influence_level INTEGER, -- 1-5 scale
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    
    UNIQUE(opportunity_project_id, contact_id, relationship_type)
);
```

---

## 3. ADVANCED ENTITIES

### 3.1 Document Management with Solid File Structure

```sql
-- Document categories and types
CREATE TABLE document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES document_categories(id),
    is_system_category BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, name, COALESCE(parent_category_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

-- Main documents table with comprehensive file management
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    opportunity_project_id UUID REFERENCES opportunity_projects(id) ON DELETE CASCADE,
    
    -- File identification
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_extension VARCHAR(10),
    mime_type VARCHAR(100),
    file_size_bytes BIGINT NOT NULL,
    
    -- File storage (solid structure)
    storage_provider VARCHAR(50) NOT NULL DEFAULT 's3', -- s3, azure_blob, gcs, local
    storage_region VARCHAR(50),
    storage_bucket VARCHAR(100),
    storage_key VARCHAR(1000) NOT NULL, -- full path with organized structure
    storage_url VARCHAR(1000), -- if public/signed URL needed
    
    -- File integrity and security
    file_hash_md5 VARCHAR(32),
    file_hash_sha256 VARCHAR(64),
    is_encrypted BOOLEAN DEFAULT false,
    encryption_key_id VARCHAR(100), -- reference to key management system
    
    -- Document metadata
    category_id UUID REFERENCES document_categories(id),
    document_type VARCHAR(100), -- solicitation, amendment, qna_response, proposal, capture_plan, etc.
    document_source VARCHAR(50) DEFAULT 'internal', -- internal, external_sync
    
    -- External synchronization (if synced from external source)
    external_document_id VARCHAR(255),
    external_sync_timestamp TIMESTAMP WITH TIME ZONE,
    is_synced_from_external BOOLEAN DEFAULT false,
    
    -- Version control
    version_number INTEGER DEFAULT 1,
    is_current_version BOOLEAN DEFAULT true,
    parent_document_id UUID REFERENCES documents(id), -- for version chains
    
    -- Access control
    access_level VARCHAR(50) DEFAULT 'project_team', -- public, project_team, restricted, confidential
    is_searchable BOOLEAN DEFAULT true,
    
    -- Content and indexing
    extracted_text TEXT, -- for full-text search
    content_preview TEXT, -- first 500 characters
    page_count INTEGER,
    
    -- Metadata and tags
    tags JSONB DEFAULT '[]',
    custom_metadata JSONB DEFAULT '{}',
    
    -- Status
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, ready, error
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    
    -- Audit
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure file uniqueness per project
    UNIQUE(tenant_id, opportunity_project_id, storage_key)
);

-- Document associations (many-to-many relationships)
CREATE TABLE document_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Associated entity
    entity_type VARCHAR(50) NOT NULL, -- opportunity_project, contact, activity, proposal, capture_plan
    entity_id UUID NOT NULL,
    
    association_type VARCHAR(50), -- primary, supporting, reference, attachment
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    
    UNIQUE(document_id, entity_type, entity_id, association_type)
);

-- Document access logs for compliance
CREATE TABLE document_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    access_type VARCHAR(50) NOT NULL, -- view, download, share, modify
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    failure_reason TEXT,
    
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2 Activity and Workflow Management

```sql
-- Activities (pursuit activities, meetings, milestones)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Associated entity
    entity_type VARCHAR(50) NOT NULL, -- opportunity_project, contact, organization
    entity_id UUID NOT NULL,
    
    -- Activity details
    activity_type VARCHAR(100) NOT NULL, -- meeting, call, email, milestone, task, shipley_step
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scheduling
    activity_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE,
    
    -- Assignment and status
    assigned_to UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled, overdue
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    
    -- Progress tracking
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- External trigger tracking
    triggered_by_external_change BOOLEAN DEFAULT false,
    external_change_reference UUID,
    
    -- Metadata
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Activity participants (for meetings, collaborations)
CREATE TABLE activity_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    
    participant_type VARCHAR(50) NOT NULL, -- user, contact
    participant_id UUID NOT NULL, -- references users(id) or contacts(id)
    
    role VARCHAR(50), -- organizer, required, optional, observer
    response_status VARCHAR(50), -- pending, accepted, declined, tentative
    
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by UUID NOT NULL REFERENCES users(id)
);
```

### 3.3 Comprehensive Audit and Change Tracking

```sql
-- Comprehensive audit logs for all system actions
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Actor information
    user_id UUID REFERENCES users(id), -- NULL for system actions
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- Action details
    action_type VARCHAR(100) NOT NULL, -- create, read, update, delete, export, sync, login, logout
    entity_type VARCHAR(100) NOT NULL, -- opportunity_project, document, user, etc.
    entity_id UUID,
    operation_description VARCHAR(500),
    
    -- Data changes (for create/update/delete operations)
    before_values JSONB,
    after_values JSONB,
    changed_fields JSONB, -- array of field names
    change_reason VARCHAR(255),
    
    -- Security and compliance
    access_granted BOOLEAN DEFAULT true,
    permission_used VARCHAR(100),
    risk_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    
    -- Request context
    request_id VARCHAR(100), -- for tracing related actions
    api_endpoint VARCHAR(255),
    http_method VARCHAR(10),
    response_status INTEGER,
    
    timestamp_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detailed change history for all entities
CREATE TABLE change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity identification
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Change details
    change_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    field_name VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    
    -- Change source
    changed_by_user_id UUID REFERENCES users(id),
    changed_by_system_process VARCHAR(100), -- external_sync, automated_workflow, etc.
    change_source VARCHAR(50) NOT NULL, -- user_action, external_sync, system_process
    change_category VARCHAR(50), -- data_update, status_change, assignment_change, etc.
    
    -- Impact and notifications
    change_impact_level VARCHAR(20) DEFAULT 'informational', -- critical, important, informational
    notification_triggered BOOLEAN DEFAULT false,
    
    -- Grouping related changes
    parent_change_id UUID REFERENCES change_history(id),
    change_batch_id UUID, -- for grouping simultaneous changes
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions for security tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    session_token_hash VARCHAR(255) NOT NULL UNIQUE,
    
    -- Session details
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Security context
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Termination
    terminated_at TIMESTAMP WITH TIME ZONE,
    termination_reason VARCHAR(100), -- logout, timeout, admin_revoke, security_breach
    
    -- Security validation
    mfa_verified BOOLEAN DEFAULT false,
    permissions_snapshot JSONB -- snapshot of permissions at session creation
);

-- Permission checks audit for compliance
CREATE TABLE permission_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Resource access attempt
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    permission_checked VARCHAR(100) NOT NULL,
    permission_granted BOOLEAN NOT NULL,
    
    -- Decision details
    role_used VARCHAR(100),
    explicit_permission BOOLEAN DEFAULT false,
    denial_reason TEXT,
    
    -- Context
    ip_address INET,
    timestamp_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.4 API Integration and Polling Management

```sql
-- Polling configurations for external data sync
CREATE TABLE polling_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_project_id UUID NOT NULL REFERENCES opportunity_projects(id) ON DELETE CASCADE,
    external_source_id UUID NOT NULL REFERENCES external_opportunity_sources(id),
    
    -- Polling settings
    polling_frequency_minutes INTEGER NOT NULL DEFAULT 60, -- hourly default
    is_active BOOLEAN DEFAULT true,
    priority_level VARCHAR(20) DEFAULT 'normal', -- low, normal, high
    
    -- Timing
    last_poll_timestamp TIMESTAMP WITH TIME ZONE,
    next_poll_timestamp TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    consecutive_errors INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
    
    -- Performance tracking
    average_response_time_ms INTEGER,
    success_rate_percentage DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- API integration logs for monitoring and debugging
CREATE TABLE api_integration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_source_id UUID NOT NULL REFERENCES external_opportunity_sources(id),
    opportunity_project_id UUID REFERENCES opportunity_projects(id),
    
    -- Request details
    api_call_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    endpoint_called VARCHAR(500) NOT NULL,
    http_method VARCHAR(10) NOT NULL,
    http_status INTEGER,
    
    -- Request/response data
    request_headers JSONB,
    request_payload JSONB,
    response_headers JSONB,
    response_payload JSONB,
    error_message TEXT,
    
    -- Performance metrics
    processing_time_ms INTEGER,
    rate_limit_remaining INTEGER,
    rate_limit_reset_at TIMESTAMP WITH TIME ZONE,
    
    -- Success/failure tracking
    success BOOLEAN NOT NULL,
    retry_attempt INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- External data changes tracking
CREATE TABLE external_data_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_project_id UUID NOT NULL REFERENCES opportunity_projects(id) ON DELETE CASCADE,
    
    -- Change details
    change_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_fields JSONB NOT NULL, -- array of field names that changed
    previous_values JSONB,
    new_values JSONB,
    
    -- Change classification
    change_type VARCHAR(50) NOT NULL, -- update, amendment, status_change, document_added
    impact_level VARCHAR(20) NOT NULL DEFAULT 'informational', -- critical, important, informational
    
    -- Notification and acknowledgment
    notification_sent BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledgment_notes TEXT,
    
    -- External source reference
    external_source_id UUID NOT NULL REFERENCES external_opportunity_sources(id),
    external_change_id VARCHAR(255), -- if external system provides change IDs
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. FILE MANAGEMENT STRUCTURE

### 4.1 Solid File Organization Strategy

```sql
-- File storage organization follows this structure:
-- /{tenant_id}/
--   /opportunity_projects/{project_id}/
--     /documents/
--       /external_sync/
--         /{document_type}/{yyyy}/{mm}/
--       /internal/
--         /capture_plans/
--         /proposals/
--         /presentations/
--         /contracts/
--         /correspondence/
--       /versions/
--         /{document_id}/v{version_number}/
--   /system/
--     /templates/
--     /exports/
--       /{user_id}/{yyyy}/{mm}/{dd}/

-- File storage path generator function
CREATE OR REPLACE FUNCTION generate_document_storage_path(
    p_tenant_id UUID,
    p_project_id UUID,
    p_document_type VARCHAR(100),
    p_document_source VARCHAR(50),
    p_filename VARCHAR(255)
) RETURNS VARCHAR(1000) AS $$
DECLARE
    base_path VARCHAR(1000);
    current_date DATE := CURRENT_DATE;
BEGIN
    base_path := p_tenant_id::text || '/opportunity_projects/' || p_project_id::text || '/documents/';
    
    IF p_document_source = 'external_sync' THEN
        base_path := base_path || 'external_sync/' || p_document_type || '/' || 
                    EXTRACT(YEAR FROM current_date)::text || '/' ||
                    LPAD(EXTRACT(MONTH FROM current_date)::text, 2, '0') || '/';
    ELSE
        base_path := base_path || 'internal/' || p_document_type || '/';
    END IF;
    
    RETURN base_path || p_filename;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 File Version Management

```sql
-- Triggers for version management
CREATE OR REPLACE FUNCTION handle_document_versioning()
RETURNS TRIGGER AS $$
BEGIN
    -- If updating an existing document, create new version
    IF TG_OP = 'UPDATE' AND (
        OLD.file_size_bytes != NEW.file_size_bytes OR 
        OLD.file_hash_sha256 != NEW.file_hash_sha256
    ) THEN
        -- Mark old version as non-current
        UPDATE documents 
        SET is_current_version = false 
        WHERE id = OLD.id;
        
        -- Create new version
        NEW.version_number := OLD.version_number + 1;
        NEW.parent_document_id := CASE 
            WHEN OLD.parent_document_id IS NULL THEN OLD.id 
            ELSE OLD.parent_document_id 
        END;
        NEW.is_current_version := true;
        NEW.id := gen_random_uuid(); -- New ID for new version
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_versioning_trigger
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION handle_document_versioning();
```

### 4.3 File Security and Access Control

```sql
-- Row Level Security (RLS) for documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy for document access based on tenant and project permissions
CREATE POLICY documents_tenant_isolation ON documents
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY documents_project_access ON documents
    USING (
        -- User has access to the opportunity project
        opportunity_project_id IN (
            SELECT op.id FROM opportunity_projects op
            JOIN user_roles ur ON (ur.opportunity_project_id = op.id OR ur.opportunity_project_id IS NULL)
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = current_setting('app.current_user_id')::UUID
            AND op.tenant_id = current_setting('app.current_tenant_id')::UUID
            AND (r.permissions @> '["documents.read"]' OR r.permissions @> '["admin.all"]')
        )
        OR
        -- Document is public within tenant
        access_level = 'public'
    );
```

---

## 5. PERFORMANCE OPTIMIZATION

### 5.1 Essential Indexes

```sql
-- Performance indexes for enterprise scale (500+ users, 1000+ projects per tenant)

-- Tenant isolation indexes (critical for multi-tenant performance)
CREATE INDEX CONCURRENTLY idx_opportunity_projects_tenant_id ON opportunity_projects(tenant_id);
CREATE INDEX CONCURRENTLY idx_users_tenant_id ON users(tenant_id);
CREATE INDEX CONCURRENTLY idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX CONCURRENTLY idx_activities_tenant_id ON activities(tenant_id);
CREATE INDEX CONCURRENTLY idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- Opportunity project performance indexes
CREATE INDEX CONCURRENTLY idx_opportunity_projects_status ON opportunity_projects(tenant_id, project_status, pipeline_stage);
CREATE INDEX CONCURRENTLY idx_opportunity_projects_assigned ON opportunity_projects(tenant_id, assigned_capture_manager);
CREATE INDEX CONCURRENTLY idx_opportunity_projects_sync ON opportunity_projects(external_source_id, last_synced_at);

-- External data versioning indexes
CREATE INDEX CONCURRENTLY idx_external_opportunity_data_current ON external_opportunity_data(opportunity_project_id, is_current_version);
CREATE INDEX CONCURRENTLY idx_external_opportunity_data_timestamp ON external_opportunity_data(opportunity_project_id, data_snapshot_timestamp DESC);

-- Document management indexes
CREATE INDEX CONCURRENTLY idx_documents_project ON documents(tenant_id, opportunity_project_id, is_current_version) WHERE is_deleted = false;
CREATE INDEX CONCURRENTLY idx_documents_search ON documents USING gin(to_tsvector('english', name || ' ' || COALESCE(extracted_text, ''))) WHERE is_searchable = true;
CREATE INDEX CONCURRENTLY idx_documents_type ON documents(tenant_id, document_type, created_at DESC);

-- Activity and workflow indexes
CREATE INDEX CONCURRENTLY idx_activities_entity ON activities(tenant_id, entity_type, entity_id, activity_date DESC);
CREATE INDEX CONCURRENTLY idx_activities_assigned ON activities(tenant_id, assigned_to, status, due_date);

-- Audit and compliance indexes
CREATE INDEX CONCURRENTLY idx_audit_logs_user_timestamp ON audit_logs(tenant_id, user_id, timestamp_utc DESC);
CREATE INDEX CONCURRENTLY idx_audit_logs_entity ON audit_logs(tenant_id, entity_type, entity_id, timestamp_utc DESC);
CREATE INDEX CONCURRENTLY idx_change_history_entity ON change_history(entity_type, entity_id, change_timestamp DESC);

-- API integration indexes
CREATE INDEX CONCURRENTLY idx_api_logs_source_timestamp ON api_integration_logs(external_source_id, api_call_timestamp DESC);
CREATE INDEX CONCURRENTLY idx_polling_config_active ON polling_configurations(is_active, next_poll_timestamp) WHERE is_active = true;
```

### 5.2 Query Optimization Functions

```sql
-- Materialized view for opportunity project dashboard performance
CREATE MATERIALIZED VIEW mv_opportunity_project_dashboard AS
SELECT 
    op.id,
    op.tenant_id,
    op.project_name,
    op.pipeline_stage,
    op.project_status,
    op.win_probability_score,
    op.strategic_value_score,
    op.assigned_capture_manager,
    op.last_synced_at,
    
    -- Latest external data
    eod.title,
    eod.estimated_value_max,
    eod.response_due_date,
    eod.solicitation_status,
    
    -- Activity summary
    act_summary.total_activities,
    act_summary.completed_activities,
    act_summary.overdue_activities,
    
    -- Document count
    doc_summary.document_count,
    doc_summary.latest_document_date,
    
    -- Change tracking
    CASE WHEN ec.change_count > 0 THEN true ELSE false END as has_recent_changes
    
FROM opportunity_projects op
LEFT JOIN external_opportunity_data eod ON eod.opportunity_project_id = op.id AND eod.is_current_version = true
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_activities,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_activities,
        COUNT(*) FILTER (WHERE status = 'pending' AND due_date < NOW()) as overdue_activities
    FROM activities a 
    WHERE a.entity_type = 'opportunity_project' AND a.entity_id = op.id
) act_summary ON true
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as document_count,
        MAX(created_at) as latest_document_date
    FROM documents d 
    WHERE d.opportunity_project_id = op.id AND d.is_deleted = false
) doc_summary ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) as change_count
    FROM external_data_changes edc 
    WHERE edc.opportunity_project_id = op.id 
    AND edc.change_timestamp > NOW() - INTERVAL '24 hours'
    AND edc.acknowledged_by IS NULL
) ec ON true;

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_opportunity_dashboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_opportunity_project_dashboard;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. DATA ARCHIVING AND RETENTION

### 6.1 Archiving Strategy

```sql
-- Archive completed/cancelled opportunity projects
CREATE TABLE archived_opportunity_projects (
    LIKE opportunity_projects INCLUDING ALL
);

-- Archive function for completed projects
CREATE OR REPLACE FUNCTION archive_completed_projects(cutoff_date DATE DEFAULT CURRENT_DATE - INTERVAL '2 years')
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move completed projects older than cutoff date to archive
    WITH archived_projects AS (
        DELETE FROM opportunity_projects 
        WHERE project_status IN ('completed', 'cancelled') 
        AND updated_at < cutoff_date
        RETURNING *
    )
    INSERT INTO archived_opportunity_projects 
    SELECT * FROM archived_projects;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- Create JSON export for archived projects
    INSERT INTO document_exports (
        tenant_id,
        export_type,
        data_payload,
        created_by
    )
    SELECT DISTINCT
        tenant_id,
        'archived_projects',
        jsonb_agg(to_jsonb(aop.*)),
        '00000000-0000-0000-0000-000000000000'::UUID -- system user
    FROM archived_opportunity_projects aop
    WHERE aop.updated_at >= cutoff_date - INTERVAL '1 day'
    GROUP BY tenant_id;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
```

This comprehensive PostgreSQL data model provides:

1. **Enterprise-scale multi-tenant architecture** with proper isolation
2. **Complete audit trails** for FedRAMP compliance  
3. **Version-based conflict resolution** with no data loss
4. **Solid file management structure** with organized storage paths
5. **Performance optimization** for 500+ users and 1000+ projects per tenant
6. **Comprehensive security** with Row Level Security and audit logging
7. **Scalable design** ready for horizontal and vertical scaling

The file structure ensures organized, secure, and efficient document management while maintaining complete traceability and compliance with government contracting requirements.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Read and analyze existing PDF and video documentation", "status": "completed", "id": "1"}, {"content": "Create project folder structure (/project, /docs, /research)", "status": "completed", "id": "2"}, {"content": "Research DelTek GovWin CRM online for additional requirements", "status": "completed", "id": "3"}, {"content": "Synthesize research data and create comprehensive requirements document", "status": "completed", "id": "4"}, {"content": "Identify critical requirement gaps and questions", "status": "completed", "id": "5"}, {"content": "Research software requirements best practices for CRM/API integration projects", "status": "completed", "id": "6"}, {"content": "Implement answered questions into comprehensive requirements", "status": "completed", "id": "7"}, {"content": "Create document structure recommendation", "status": "completed", "id": "8"}, {"content": "Improve section delineation in comprehensive document", "status": "completed", "id": "9"}, {"content": "Design PostgreSQL data model with solid file structure", "status": "completed", "id": "10"}, {"content": "Create technical architecture document (pgBouncer, Prisma, tRPC, React)", "status": "in_progress", "id": "11"}]