# Prisma Schema Implementation - GWM CRM

---

## TABLE OF CONTENTS

### 1. PRISMA CONFIGURATION
- Database Configuration
- Generator Settings
- Schema Structure Overview

### 2. CORE SCHEMA IMPLEMENTATION
- Multi-Tenant Foundation
- User Management & Authentication
- Opportunity Project Management
- External Data Integration

### 3. ADVANCED SCHEMA COMPONENTS
- Document Management
- Activity & Workflow Tracking
- Comprehensive Audit System
- API Integration & Polling

### 4. SCHEMA OPTIMIZATION
- Indexes and Performance
- Relations and Constraints
- Custom Functions and Triggers

### 5. MIGRATION STRATEGY
- Initial Migration Setup
- Development Workflow
- Production Deployment

---

## 1. PRISMA CONFIGURATION

### Complete Prisma Schema (schema.prisma)

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["multiSchema", "relationJoins", "fullTextSearch", "postgresqlExtensions"]
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DATABASE_DIRECT_URL")
  extensions = [pgcrypto, pg_stat_statements]
}

// ================================
// MULTI-TENANT FOUNDATION
// ================================

/// Core tenant management for multi-tenant SaaS
model Tenant {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String   @db.VarChar(255)
  subdomain String   @unique @db.VarChar(100)
  
  // Subscription and billing
  planType  String   @map("plan_type") @db.VarChar(50)
  maxUsers  Int      @default(100) @map("max_users")
  maxOpportunityProjects Int @default(500) @map("max_opportunity_projects")
  isActive  Boolean  @default(true) @map("is_active")
  fedrampCompliant Boolean @default(false) @map("fedramp_compliant")
  
  subscriptionStatus String? @map("subscription_status") @db.VarChar(50)
  subscriptionExpiresAt DateTime? @map("subscription_expires_at") @db.Timestamptz(6)
  billingEmail String? @map("billing_email") @db.VarChar(255)
  
  // Audit fields
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String?  @map("created_by") @db.Uuid
  updatedBy String?  @map("updated_by") @db.Uuid
  
  // Relations
  users                    User[]
  roles                    Role[]
  opportunityProjects     OpportunityProject[]
  organizations           Organization[]
  contacts                Contact[]
  documents               Document[]
  activities              Activity[]
  auditLogs               AuditLog[]
  externalOpportunitySources ExternalOpportunitySource[]
  tenantConfigurations    TenantConfiguration[]
  
  @@map("tenants")
}

/// Tenant configuration for customization
model TenantConfiguration {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  
  configKey   String @map("config_key") @db.VarChar(100)
  configValue Json   @map("config_value")
  configType  String @map("config_type") @db.VarChar(50)
  isEncrypted Boolean @default(false) @map("is_encrypted")
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, configKey])
  @@map("tenant_configurations")
}

// ================================
// USER MANAGEMENT & AUTHENTICATION
// ================================

/// Users with comprehensive RBAC
model User {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  
  // Authentication
  email         String    @db.VarChar(255)
  passwordHash  String?   @map("password_hash") @db.VarChar(255)
  isSamlUser    Boolean   @default(false) @map("is_saml_user")
  samlId        String?   @map("saml_id") @db.VarChar(255)
  
  // Profile information
  firstName String  @map("first_name") @db.VarChar(100)
  lastName  String  @map("last_name") @db.VarChar(100)
  title     String? @db.VarChar(150)
  phone     String? @db.VarChar(50)
  avatarUrl String? @map("avatar_url") @db.VarChar(500)
  
  // Account status
  isActive        Boolean   @default(true) @map("is_active")
  emailVerified   Boolean   @default(false) @map("email_verified")
  lastLoginAt     DateTime? @map("last_login_at") @db.Timestamptz(6)
  passwordChangedAt DateTime @default(now()) @map("password_changed_at") @db.Timestamptz(6)
  
  // Security features
  failedLoginAttempts Int       @default(0) @map("failed_login_attempts")
  lockedUntil         DateTime? @map("locked_until") @db.Timestamptz(6)
  mfaEnabled          Boolean   @default(false) @map("mfa_enabled")
  mfaSecretEncrypted  String?   @map("mfa_secret_encrypted") @db.Text
  
  // Audit fields
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String?  @map("created_by") @db.Uuid
  
  // Relations
  tenant              Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userRoles          UserRole[]
  userSessions       UserSession[]
  
  // Opportunity project assignments
  opportunityProjectsAsCapture OpportunityProject[] @relation("CaptureManager")
  opportunityProjectsAsProposal OpportunityProject[] @relation("ProposalManager")
  
  // Created entities
  documentsUploaded  Document[] @relation("DocumentUploader")
  activitiesCreated  Activity[] @relation("ActivityCreator")
  auditLogs          AuditLog[]
  
  // Change history
  changesCreated     ChangeHistory[] @relation("ChangeCreator")
  changesAcknowledged ExternalDataChange[] @relation("ChangeAcknowledger")
  
  @@unique([tenantId, email])
  @@index([tenantId, isActive])
  @@index([email])
  @@map("users")
}

/// Role-based access control roles
model Role {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  
  name         String  @db.VarChar(100)
  description  String? @db.Text
  isSystemRole Boolean @default(false) @map("is_system_role")
  permissions  Json    @default("[]")
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  // Relations
  tenant    Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userRoles UserRole[]
  
  @@unique([tenantId, name])
  @@index([tenantId, isSystemRole])
  @@map("roles")
}

/// User role assignments
model UserRole {
  id     String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId String @map("user_id") @db.Uuid
  roleId String @map("role_id") @db.Uuid
  
  // Optional project-level assignments
  opportunityProjectId String? @map("opportunity_project_id") @db.Uuid
  
  assignedAt DateTime  @default(now()) @map("assigned_at") @db.Timestamptz(6)
  assignedBy String    @map("assigned_by") @db.Uuid
  expiresAt  DateTime? @map("expires_at") @db.Timestamptz(6)
  
  // Relations
  user               User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  role               Role                @relation(fields: [roleId], references: [id], onDelete: Cascade)
  opportunityProject OpportunityProject? @relation(fields: [opportunityProjectId], references: [id], onDelete: Cascade)
  
  @@unique([userId, roleId, opportunityProjectId])
  @@index([userId, roleId])
  @@map("user_roles")
}

/// User session management
model UserSession {
  id               String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId           String @map("user_id") @db.Uuid
  sessionTokenHash String @unique @map("session_token_hash") @db.VarChar(255)
  
  // Session details
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  lastActivityAt  DateTime  @default(now()) @map("last_activity_at") @db.Timestamptz(6)
  expiresAt       DateTime? @map("expires_at") @db.Timestamptz(6)
  
  // Security context
  ipAddress       String? @map("ip_address") @db.Inet
  userAgent       String? @map("user_agent") @db.Text
  isActive        Boolean @default(true) @map("is_active")
  
  // Termination tracking
  terminatedAt     DateTime? @map("terminated_at") @db.Timestamptz(6)
  terminationReason String?   @map("termination_reason") @db.VarChar(100)
  
  // Security validation
  mfaVerified        Boolean @default(false) @map("mfa_verified")
  permissionsSnapshot Json?   @map("permissions_snapshot")
  
  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, isActive])
  @@index([sessionTokenHash])
  @@map("user_sessions")
}

// ================================
// EXTERNAL DATA SOURCE MANAGEMENT
// ================================

/// External data sources (internal API endpoints)
model ExternalOpportunitySource {
  id       String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid
  
  sourceName  String @map("source_name") @db.VarChar(100)
  apiEndpoint String @map("api_endpoint") @db.VarChar(500)
  apiVersion  String @map("api_version") @db.VarChar(20)
  
  // Authentication (per-tenant for FedRAMP compliance)
  authenticationType   String @map("authentication_type") @db.VarChar(50)
  apiCredentialsEncrypted Json   @map("api_credentials_encrypted")
  
  // Rate limiting and performance
  rateLimitPerHour Int @default(1000) @map("rate_limit_per_hour")
  timeoutSeconds   Int @default(30) @map("timeout_seconds")
  retryAttempts    Int @default(3) @map("retry_attempts")
  
  // Status and health monitoring
  isActive             Boolean   @default(true) @map("is_active")
  connectionStatus     String    @default("unknown") @map("connection_status") @db.VarChar(50)
  lastSuccessfulCall   DateTime? @map("last_successful_call") @db.Timestamptz(6)
  lastErrorMessage     String?   @map("last_error_message") @db.Text
  consecutiveErrors    Int       @default(0) @map("consecutive_errors")
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  
  // Relations
  tenant                 Tenant                   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  opportunityProjects    OpportunityProject[]
  pollingConfigurations  PollingConfiguration[]
  apiIntegrationLogs     ApiIntegrationLog[]
  externalDataChanges    ExternalDataChange[]
  
  @@unique([tenantId, sourceName])
  @@index([tenantId, isActive])
  @@map("external_opportunity_sources")
}

// ================================
// OPPORTUNITY PROJECT MANAGEMENT
// ================================

/// Core opportunity projects (selected opportunities being pursued)
model OpportunityProject {
  id       String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid
  
  // Project identification
  projectName              String  @map("project_name") @db.VarChar(255)
  internalReferenceNumber  String? @map("internal_reference_number") @db.VarChar(100)
  
  // External source linkage
  externalSourceId      String @map("external_source_id") @db.Uuid
  externalOpportunityId String @map("external_opportunity_id") @db.VarChar(255)
  externalOpportunityUrl String? @map("external_opportunity_url") @db.VarChar(1000)
  
  // Basic opportunity data (synced from external source)
  solicitationNumber String? @map("solicitation_number") @db.VarChar(100)
  agencyName         String? @map("agency_name") @db.VarChar(255)
  contractingOffice  String? @map("contracting_office") @db.VarChar(255)
  title              String? @db.VarChar(500)
  description        String? @db.Text
  
  // Project management
  projectStatus   String @default("active") @map("project_status") @db.VarChar(50)
  pipelineStage   String @default("phase_0") @map("pipeline_stage") @db.VarChar(50)
  priorityLevel   String @default("medium") @map("priority_level") @db.VarChar(20)
  
  // Scoring and assessment
  winProbabilityScore  Decimal? @map("win_probability_score") @db.Decimal(5,2)
  strategicValueScore  Decimal? @map("strategic_value_score") @db.Decimal(5,2)
  pursuitHealthScore   Decimal? @map("pursuit_health_score") @db.Decimal(5,2)
  
  // Team assignments
  assignedCaptureManagerId  String? @map("assigned_capture_manager") @db.Uuid
  assignedProposalManagerId String? @map("assigned_proposal_manager") @db.Uuid
  assignedTeamMembers       Json    @default("[]") @map("assigned_team_members")
  
  // Synchronization tracking
  lastSyncedAt     DateTime? @map("last_synced_at") @db.Timestamptz(6)
  syncStatus       String    @default("pending") @map("sync_status") @db.VarChar(50)
  syncErrorMessage String?   @map("sync_error_message") @db.Text
  versionHash      String?   @map("version_hash") @db.VarChar(64)
  
  // Audit fields
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  
  // Relations
  tenant         Tenant                   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  externalSource ExternalOpportunitySource @relation(fields: [externalSourceId], references: [id])
  captureManager User?                     @relation("CaptureManager", fields: [assignedCaptureManagerId], references: [id])
  proposalManager User?                    @relation("ProposalManager", fields: [assignedProposalManagerId], references: [id])
  
  // Related entities
  externalOpportunityData ExternalOpportunityData[]
  opportunityProjectOverrides OpportunityProjectOverride[]
  documents               Document[]
  activities              Activity[]
  contacts                OpportunityProjectContact[]
  pollingConfigurations   PollingConfiguration[]
  externalDataChanges     ExternalDataChange[]
  userRoles               UserRole[]
  capturePlans            CapturePlan[]
  proposals               Proposal[]
  
  @@unique([tenantId, externalSourceId, externalOpportunityId])
  @@index([tenantId, projectStatus, pipelineStage])
  @@index([tenantId, assignedCaptureManagerId])
  @@index([externalSourceId, lastSyncedAt])
  @@map("opportunity_projects")
}

/// Versioned external opportunity data (complete history)
model ExternalOpportunityData {
  id                   String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  opportunityProjectId String @map("opportunity_project_id") @db.Uuid
  
  // Version tracking
  dataSnapshotTimestamp DateTime @map("data_snapshot_timestamp") @db.Timestamptz(6)
  versionNumber         Int      @map("version_number")
  isCurrentVersion      Boolean  @default(true) @map("is_current_version")
  
  // Opportunity details from external source
  title               String?   @db.VarChar(500)
  description         String?   @db.Text
  opportunityType     String?   @map("opportunity_type") @db.VarChar(100)
  setAsideType        String?   @map("set_aside_type") @db.VarChar(100)
  naicsCodes          String?   @map("naics_codes") @db.VarChar(200)
  estimatedValueMin   Decimal?  @map("estimated_value_min") @db.Decimal(15,2)
  estimatedValueMax   Decimal?  @map("estimated_value_max") @db.Decimal(15,2)
  postingDate         DateTime? @map("posting_date") @db.Date
  responseDueDate     DateTime? @map("response_due_date") @db.Timestamptz(6)
  placeOfPerformance  String?   @map("place_of_performance") @db.Text
  
  // Status and amendments
  solicitationStatus String? @map("solicitation_status") @db.VarChar(50)
  amendmentNumber    Int     @default(0) @map("amendment_number")
  
  // Complete external data payload
  rawJsonData Json @map("raw_json_data")
  
  // Change tracking
  changeDetectedAt DateTime? @map("change_detected_at") @db.Timestamptz(6)
  changedFields    Json?     @map("changed_fields")
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  
  // Relations
  opportunityProject OpportunityProject @relation(fields: [opportunityProjectId], references: [id], onDelete: Cascade)
  
  @@index([opportunityProjectId, isCurrentVersion])
  @@index([opportunityProjectId, dataSnapshotTimestamp(sort: Desc)])
  @@map("external_opportunity_data")
}

/// Local overrides for opportunity project data
model OpportunityProjectOverride {
  id                   String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  opportunityProjectId String @map("opportunity_project_id") @db.Uuid
  
  fieldName              String  @map("field_name") @db.VarChar(100)
  originalExternalValue  Json?   @map("original_external_value")
  overrideValue          Json    @map("override_value")
  overrideReason         String? @map("override_reason") @db.Text
  
  isActive Boolean @default(true) @map("is_active")
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  
  // Relations
  opportunityProject OpportunityProject @relation(fields: [opportunityProjectId], references: [id], onDelete: Cascade)
  
  @@unique([opportunityProjectId, fieldName])
  @@map("opportunity_project_overrides")
}

// ================================
// ORGANIZATIONS & CONTACTS
// ================================

/// Organizations (government agencies, contractors, partners)
model Organization {
  id       String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid
  
  // Basic information
  name         String  @db.VarChar(255)
  dunsNumber   String? @map("duns_number") @db.VarChar(13)
  samUniqueId  String? @map("sam_unique_id") @db.VarChar(50)
  cageCode     String? @map("cage_code") @db.VarChar(10)
  
  // Address information
  addressLine1   String? @map("address_line1") @db.VarChar(255)
  addressLine2   String? @map("address_line2") @db.VarChar(255)
  city           String? @db.VarChar(100)
  stateProvince  String? @map("state_province") @db.VarChar(100)
  postalCode     String? @map("postal_code") @db.VarChar(20)
  country        String  @default("United States") @db.VarChar(100)
  
  // Contact information
  phone   String? @db.VarChar(50)
  email   String? @db.VarChar(255)
  website String? @db.VarChar(500)
  
  // Business classification
  organizationType          String? @map("organization_type") @db.VarChar(100)
  businessSize              String? @map("business_size") @db.VarChar(50)
  socioeconomicCertifications Json   @default("[]") @map("socioeconomic_certifications")
  
  // Hierarchy support
  parentOrganizationId String? @map("parent_organization_id") @db.Uuid
  
  // Status
  isActive Boolean @default(true) @map("is_active")
  
  // Audit fields
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  updatedBy String?  @map("updated_by") @db.Uuid
  
  // Relations
  tenant             Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parentOrganization Organization? @relation("OrganizationHierarchy", fields: [parentOrganizationId], references: [id])
  childOrganizations Organization[] @relation("OrganizationHierarchy")
  contacts           Contact[]
  
  @@index([tenantId, isActive])
  @@index([name])
  @@map("organizations")
}

/// Contacts within organizations
model Contact {
  id             String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId       String  @map("tenant_id") @db.Uuid
  organizationId String? @map("organization_id") @db.Uuid
  
  // Personal information
  firstName   String  @map("first_name") @db.VarChar(100)
  lastName    String  @map("last_name") @db.VarChar(100)
  title       String? @db.VarChar(150)
  email       String? @db.VarChar(255)
  phone       String? @db.VarChar(50)
  linkedinUrl String? @map("linkedin_url") @db.VarChar(500)
  
  // Professional classification
  contactType           String? @map("contact_type") @db.VarChar(50)
  decisionMakerLevel    Int?    @map("decision_maker_level")
  securityClearance     String? @map("security_clearance") @db.VarChar(50)
  
  // Interaction tracking
  lastContactDate       DateTime? @map("last_contact_date") @db.Date
  interactionFrequency  String?   @map("interaction_frequency") @db.VarChar(50)
  relationshipStrength  Int?      @map("relationship_strength")
  
  // Additional data
  notes String? @db.Text
  tags  Json    @default("[]")
  
  isActive Boolean @default(true) @map("is_active")
  
  // Audit fields
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  updatedBy String?  @map("updated_by") @db.Uuid
  
  // Relations
  tenant                     Tenant                      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  organization               Organization?               @relation(fields: [organizationId], references: [id])
  opportunityProjectContacts OpportunityProjectContact[]
  
  @@index([tenantId, isActive])
  @@index([email])
  @@map("contacts")
}

/// Opportunity project to contact relationships
model OpportunityProjectContact {
  id                   String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  opportunityProjectId String @map("opportunity_project_id") @db.Uuid
  contactId            String @map("contact_id") @db.Uuid
  
  relationshipType String? @map("relationship_type") @db.VarChar(50)
  influenceLevel   Int?    @map("influence_level")
  notes            String? @db.Text
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  
  // Relations
  opportunityProject OpportunityProject @relation(fields: [opportunityProjectId], references: [id], onDelete: Cascade)
  contact            Contact            @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  @@unique([opportunityProjectId, contactId, relationshipType])
  @@map("opportunity_project_contacts")
}

// ================================
// DOCUMENT MANAGEMENT
// ================================

/// Document categories and types
model DocumentCategory {
  id       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId String  @map("tenant_id") @db.Uuid
  
  name              String  @db.VarChar(100)
  description       String? @db.Text
  parentCategoryId  String? @map("parent_category_id") @db.Uuid
  isSystemCategory  Boolean @default(false) @map("is_system_category")
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  
  // Relations
  tenant           Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parentCategory   DocumentCategory?  @relation("CategoryHierarchy", fields: [parentCategoryId], references: [id])
  childCategories  DocumentCategory[] @relation("CategoryHierarchy")
  documents        Document[]
  
  @@unique([tenantId, name, parentCategoryId])
  @@map("document_categories")
}

/// Main documents table with comprehensive file management
model Document {
  id                   String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String  @map("tenant_id") @db.Uuid
  opportunityProjectId String? @map("opportunity_project_id") @db.Uuid
  
  // File identification
  name             String @db.VarChar(255)
  originalFilename String @map("original_filename") @db.VarChar(255)
  fileExtension    String? @map("file_extension") @db.VarChar(10)
  mimeType         String @map("mime_type") @db.VarChar(100)
  fileSizeBytes    BigInt @map("file_size_bytes")
  
  // File storage (organized structure)
  storageProvider String  @default("s3") @map("storage_provider") @db.VarChar(50)
  storageRegion   String? @map("storage_region") @db.VarChar(50)
  storageBucket   String? @map("storage_bucket") @db.VarChar(100)
  storageKey      String  @map("storage_key") @db.VarChar(1000)
  storageUrl      String? @map("storage_url") @db.VarChar(1000)
  
  // File integrity and security
  fileHashMd5    String? @map("file_hash_md5") @db.VarChar(32)
  fileHashSha256 String? @map("file_hash_sha256") @db.VarChar(64)
  isEncrypted    Boolean @default(false) @map("is_encrypted")
  encryptionKeyId String? @map("encryption_key_id") @db.VarChar(100)
  
  // Document metadata
  categoryId     String? @map("category_id") @db.Uuid
  documentType   String? @map("document_type") @db.VarChar(100)
  documentSource String  @default("internal") @map("document_source") @db.VarChar(50)
  
  // External synchronization
  externalDocumentId    String?   @map("external_document_id") @db.VarChar(255)
  externalSyncTimestamp DateTime? @map("external_sync_timestamp") @db.Timestamptz(6)
  isSyncedFromExternal  Boolean   @default(false) @map("is_synced_from_external")
  
  // Version control
  versionNumber     Int     @default(1) @map("version_number")
  isCurrentVersion  Boolean @default(true) @map("is_current_version")
  parentDocumentId  String? @map("parent_document_id") @db.Uuid
  
  // Access control
  accessLevel   String  @default("project_team") @map("access_level") @db.VarChar(50)
  isSearchable  Boolean @default(true) @map("is_searchable")
  
  // Content and indexing
  extractedText   String? @map("extracted_text") @db.Text
  contentPreview  String? @map("content_preview") @db.VarChar(500)
  pageCount       Int?    @map("page_count")
  
  // Metadata and tags
  tags           Json @default("[]")
  customMetadata Json @default("{}") @map("custom_metadata")
  
  // Status tracking
  processingStatus String    @default("pending") @map("processing_status") @db.VarChar(50)
  isDeleted        Boolean   @default(false) @map("is_deleted")
  deletedAt        DateTime? @map("deleted_at") @db.Timestamptz(6)
  deletedBy        String?   @map("deleted_by") @db.Uuid
  
  // Audit fields
  uploadedBy String   @map("uploaded_by") @db.Uuid
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  // Relations
  tenant             Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  opportunityProject OpportunityProject?    @relation(fields: [opportunityProjectId], references: [id], onDelete: Cascade)
  category           DocumentCategory?      @relation(fields: [categoryId], references: [id])
  uploader           User                   @relation("DocumentUploader", fields: [uploadedBy], references: [id])
  parentDocument     Document?              @relation("DocumentVersions", fields: [parentDocumentId], references: [id])
  childVersions      Document[]             @relation("DocumentVersions")
  associations       DocumentAssociation[]
  accessLogs         DocumentAccessLog[]
  
  @@unique([tenantId, opportunityProjectId, storageKey])
  @@index([tenantId, opportunityProjectId, isCurrentVersion])
  @@index([tenantId, documentType, createdAt(sort: Desc)])
  @@fulltext([name, extractedText])
  @@map("documents")
}

/// Document associations (many-to-many relationships)
model DocumentAssociation {
  id         String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  documentId String @map("document_id") @db.Uuid
  
  entityType       String  @map("entity_type") @db.VarChar(50)
  entityId         String  @map("entity_id") @db.Uuid
  associationType  String? @map("association_type") @db.VarChar(50)
  notes            String? @db.Text
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  
  // Relations
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  
  @@unique([documentId, entityType, entityId, associationType])
  @@map("document_associations")
}

/// Document access logs for compliance
model DocumentAccessLog {
  id         String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  documentId String @map("document_id") @db.Uuid
  userId     String @map("user_id") @db.Uuid
  
  accessType    String  @map("access_type") @db.VarChar(50)
  ipAddress     String? @map("ip_address") @db.Inet
  userAgent     String? @map("user_agent") @db.Text
  success       Boolean @default(true)
  failureReason String? @map("failure_reason") @db.Text
  
  accessedAt DateTime @default(now()) @map("accessed_at") @db.Timestamptz(6)
  
  // Relations
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  
  @@index([documentId, userId, accessedAt(sort: Desc)])
  @@map("document_access_logs")
}

// ================================
// ACTIVITY & WORKFLOW MANAGEMENT
// ================================

/// Activities (pursuit activities, meetings, milestones)
model Activity {
  id       String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid
  
  // Associated entity
  entityType String @map("entity_type") @db.VarChar(50)
  entityId   String @map("entity_id") @db.Uuid
  
  // Activity details
  activityType String @map("activity_type") @db.VarChar(100)
  subject      String @db.VarChar(255)
  description  String? @db.Text
  
  // Scheduling
  activityDate  DateTime? @map("activity_date") @db.Timestamptz(6)
  dueDate       DateTime? @map("due_date") @db.Timestamptz(6)
  completedDate DateTime? @map("completed_date") @db.Timestamptz(6)
  
  // Assignment and status
  assignedTo String? @map("assigned_to") @db.Uuid
  status     String  @default("pending") @map("status") @db.VarChar(50)
  priority   String  @default("medium") @map("priority") @db.VarChar(20)
  
  // Progress tracking
  completionPercentage Int @default(0) @map("completion_percentage")
  
  // External trigger tracking
  triggeredByExternalChange Boolean @default(false) @map("triggered_by_external_change")
  externalChangeReference   String? @map("external_change_reference") @db.Uuid
  
  // Metadata
  tags         Json @default("[]")
  customFields Json @default("{}") @map("custom_fields")
  
  // Audit fields
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  updatedBy String?  @map("updated_by") @db.Uuid
  
  // Relations
  tenant    Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assignee  User?                 @relation("ActivityCreator", fields: [assignedTo], references: [id])
  participants ActivityParticipant[]
  
  @@index([tenantId, entityType, entityId, activityDate(sort: Desc)])
  @@index([tenantId, assignedTo, status, dueDate])
  @@map("activities")
}

/// Activity participants (for meetings, collaborations)
model ActivityParticipant {
  id         String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  activityId String @map("activity_id") @db.Uuid
  
  participantType String @map("participant_type") @db.VarChar(50)
  participantId   String @map("participant_id") @db.Uuid
  
  role           String? @map("role") @db.VarChar(50)
  responseStatus String? @map("response_status") @db.VarChar(50)
  
  addedAt DateTime @default(now()) @map("added_at") @db.Timestamptz(6)
  addedBy String   @map("added_by") @db.Uuid
  
  // Relations
  activity Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  
  @@map("activity_participants")
}

// ================================
// ADVANCED PURSUIT MANAGEMENT
// ================================

/// Capture plans for opportunity projects
model CapturePlan {
  id                   String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  opportunityProjectId String @map("opportunity_project_id") @db.Uuid
  
  planName   String  @map("plan_name") @db.VarChar(255)
  status     String  @default("draft") @db.VarChar(50)
  
  // Decision tracking
  goNoGoDecision       String?   @map("go_no_go_decision") @db.VarChar(20)
  decisionDate         DateTime? @map("decision_date") @db.Date
  decisionRationale    String?   @map("decision_rationale") @db.Text
  
  // Planning details
  winStrategy              String? @map("win_strategy") @db.Text
  competitiveAnalysis      String? @map("competitive_analysis") @db.Text
  externalDataConsiderations String? @map("external_data_considerations") @db.Text
  resourceRequirements     String? @map("resource_requirements") @db.Text
  timeline                 String? @map("timeline") @db.Text
  externalDeadlines        String? @map("external_deadlines") @db.Text
  
  // Synchronization tracking
  lastExternalSync        DateTime? @map("last_external_sync") @db.Timestamptz(6)
  externalDataImpactNotes String?   @map("external_data_impact_notes") @db.Text
  
  // Audit fields
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  updatedBy String?  @map("updated_by") @db.Uuid
  
  // Relations
  opportunityProject OpportunityProject @relation(fields: [opportunityProjectId], references: [id], onDelete: Cascade)
  
  @@index([opportunityProjectId, status])
  @@map("capture_plans")
}

/// Proposals for opportunity projects
model Proposal {
  id                   String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  opportunityProjectId String @map("opportunity_project_id") @db.Uuid
  
  proposalTitle   String @map("proposal_title") @db.VarChar(255)
  status          String @default("draft") @map("status") @db.VarChar(50)
  proposalManager String @map("proposal_manager") @db.Uuid
  teamMembers     Json   @default("[]") @map("team_members")
  
  // Timeline tracking
  submissionDate      DateTime? @map("submission_date") @db.Timestamptz(6)
  finalSubmittalDate  DateTime? @map("final_submittal_date") @db.Timestamptz(6)
  
  // Process tracking
  complianceMatrix     Json?     @map("compliance_matrix")
  reviewStages         Json      @default("[]") @map("review_stages")
  
  // External integration
  externalDeadlineSync DateTime? @map("external_deadline_sync") @db.Timestamptz(6)
  amendmentImpactLog   Json      @default("[]") @map("amendment_impact_log")
  
  // Audit fields
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  updatedBy String?  @map("updated_by") @db.Uuid
  
  // Relations
  opportunityProject OpportunityProject @relation(fields: [opportunityProjectId], references: [id], onDelete: Cascade)
  
  @@index([opportunityProjectId, status])
  @@map("proposals")
}

// ================================
// COMPREHENSIVE AUDIT SYSTEM
// ================================

/// Comprehensive audit logs for all system actions
model AuditLog {
  id       String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid
  
  // Actor information
  userId    String? @map("user_id") @db.Uuid
  sessionId String? @map("session_id") @db.VarChar(255)
  ipAddress String? @map("ip_address") @db.Inet
  userAgent String? @map("user_agent") @db.Text
  
  // Action details
  actionType           String @map("action_type") @db.VarChar(100)
  entityType           String @map("entity_type") @db.VarChar(100)
  entityId             String? @map("entity_id") @db.Uuid
  operationDescription String? @map("operation_description") @db.VarChar(500)
  
  // Data changes
  beforeValues   Json?   @map("before_values")
  afterValues    Json?   @map("after_values")
  changedFields  Json?   @map("changed_fields")
  changeReason   String? @map("change_reason") @db.VarChar(255)
  
  // Security and compliance
  accessGranted   Boolean @default(true) @map("access_granted")
  permissionUsed  String? @map("permission_used") @db.VarChar(100)
  riskLevel       String  @default("low") @map("risk_level") @db.VarChar(20)
  
  // Request context
  requestId      String? @map("request_id") @db.VarChar(100)
  apiEndpoint    String? @map("api_endpoint") @db.VarChar(255)
  httpMethod     String? @map("http_method") @db.VarChar(10)
  responseStatus Int?    @map("response_status")
  
  timestampUtc DateTime @default(now()) @map("timestamp_utc") @db.Timestamptz(6)
  
  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User?  @relation(fields: [userId], references: [id])
  
  @@index([tenantId, userId, timestampUtc(sort: Desc)])
  @@index([tenantId, entityType, entityId, timestampUtc(sort: Desc)])
  @@index([actionType, timestampUtc(sort: Desc)])
  @@map("audit_logs")
}

/// Detailed change history for all entities
model ChangeHistory {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  
  // Entity identification
  entityType String @map("entity_type") @db.VarChar(100)
  entityId   String @map("entity_id") @db.Uuid
  
  // Change details
  changeTimestamp DateTime @default(now()) @map("change_timestamp") @db.Timestamptz(6)
  fieldName       String   @map("field_name") @db.VarChar(100)
  oldValue        Json?    @map("old_value")
  newValue        Json?    @map("new_value")
  
  // Change source
  changedByUserId        String? @map("changed_by_user_id") @db.Uuid
  changedBySystemProcess String? @map("changed_by_system_process") @db.VarChar(100)
  changeSource           String  @map("change_source") @db.VarChar(50)
  changeCategory         String? @map("change_category") @db.VarChar(50)
  
  // Impact and notifications
  changeImpactLevel     String  @default("informational") @map("change_impact_level") @db.VarChar(20)
  notificationTriggered Boolean @default(false) @map("notification_triggered")
  
  // Grouping related changes
  parentChangeId String? @map("parent_change_id") @db.Uuid
  changeBatchId  String? @map("change_batch_id") @db.Uuid
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  
  // Relations
  changedByUser  User?           @relation("ChangeCreator", fields: [changedByUserId], references: [id])
  parentChange   ChangeHistory?  @relation("ChangeHierarchy", fields: [parentChangeId], references: [id])
  childChanges   ChangeHistory[] @relation("ChangeHierarchy")
  
  @@index([entityType, entityId, changeTimestamp(sort: Desc)])
  @@index([changedByUserId, changeTimestamp(sort: Desc)])
  @@map("change_history")
}

/// Permission checks audit for compliance
model PermissionAudit {
  id     String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId String @map("user_id") @db.Uuid
  
  // Resource access attempt
  resourceType      String @map("resource_type") @db.VarChar(100)
  resourceId        String? @map("resource_id") @db.Uuid
  permissionChecked String @map("permission_checked") @db.VarChar(100)
  permissionGranted Boolean @map("permission_granted")
  
  // Decision details
  roleUsed           String? @map("role_used") @db.VarChar(100)
  explicitPermission Boolean @default(false) @map("explicit_permission")
  denialReason       String? @map("denial_reason") @db.Text
  
  // Context
  ipAddress    String? @map("ip_address") @db.Inet
  timestampUtc DateTime @default(now()) @map("timestamp_utc") @db.Timestamptz(6)
  
  @@index([userId, timestampUtc(sort: Desc)])
  @@index([resourceType, permissionGranted])
  @@map("permission_audit")
}

// ================================
// API INTEGRATION & POLLING
// ================================

/// Polling configurations for external data sync
model PollingConfiguration {
  id                   String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  opportunityProjectId String @map("opportunity_project_id") @db.Uuid
  externalSourceId     String @map("external_source_id") @db.Uuid
  
  // Polling settings
  pollingFrequencyMinutes Int     @default(60) @map("polling_frequency_minutes")
  isActive                Boolean @default(true) @map("is_active")
  priorityLevel           String  @default("normal") @map("priority_level") @db.VarChar(20)
  
  // Timing
  lastPollTimestamp DateTime? @map("last_poll_timestamp") @db.Timestamptz(6)
  nextPollTimestamp DateTime? @map("next_poll_timestamp") @db.Timestamptz(6)
  
  // Error handling
  consecutiveErrors   Int     @default(0) @map("consecutive_errors")
  maxRetries          Int     @default(3) @map("max_retries")
  backoffMultiplier   Decimal @default(2.0) @map("backoff_multiplier") @db.Decimal(3,2)
  
  // Performance tracking
  averageResponseTimeMs   Int?    @map("average_response_time_ms")
  successRatePercentage   Decimal? @map("success_rate_percentage") @db.Decimal(5,2)
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdBy String   @map("created_by") @db.Uuid
  
  // Relations
  opportunityProject OpportunityProject        @relation(fields: [opportunityProjectId], references: [id], onDelete: Cascade)
  externalSource     ExternalOpportunitySource @relation(fields: [externalSourceId], references: [id])
  
  @@index([isActive, nextPollTimestamp])
  @@index([opportunityProjectId, isActive])
  @@map("polling_configurations")
}

/// API integration logs for monitoring and debugging
model ApiIntegrationLog {
  id                   String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  externalSourceId     String  @map("external_source_id") @db.Uuid
  opportunityProjectId String? @map("opportunity_project_id") @db.Uuid
  
  // Request details
  apiCallTimestamp DateTime @default(now()) @map("api_call_timestamp") @db.Timestamptz(6)
  endpointCalled   String   @map("endpoint_called") @db.VarChar(500)
  httpMethod       String   @map("http_method") @db.VarChar(10)
  httpStatus       Int?     @map("http_status")
  
  // Request/response data
  requestHeaders  Json?   @map("request_headers")
  requestPayload  Json?   @map("request_payload")
  responseHeaders Json?   @map("response_headers")
  responsePayload Json?   @map("response_payload")
  errorMessage    String? @map("error_message") @db.Text
  
  // Performance metrics
  processingTimeMs     Int?      @map("processing_time_ms")
  rateLimitRemaining   Int?      @map("rate_limit_remaining")
  rateLimitResetAt     DateTime? @map("rate_limit_reset_at") @db.Timestamptz(6)
  
  // Success/failure tracking
  success      Boolean @map("success")
  retryAttempt Int     @default(1) @map("retry_attempt")
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  
  // Relations
  externalSource     ExternalOpportunitySource @relation(fields: [externalSourceId], references: [id])
  opportunityProject OpportunityProject?       @relation(fields: [opportunityProjectId], references: [id])
  
  @@index([externalSourceId, apiCallTimestamp(sort: Desc)])
  @@index([success, apiCallTimestamp(sort: Desc)])
  @@map("api_integration_logs")
}

/// External data changes tracking
model ExternalDataChange {
  id                   String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  opportunityProjectId String @map("opportunity_project_id") @db.Uuid
  
  // Change details
  changeTimestamp DateTime @default(now()) @map("change_timestamp") @db.Timestamptz(6)
  changedFields   Json     @map("changed_fields")
  previousValues  Json?    @map("previous_values")
  newValues       Json?    @map("new_values")
  
  // Change classification
  changeType  String @map("change_type") @db.VarChar(50)
  impactLevel String @default("informational") @map("impact_level") @db.VarChar(20)
  
  // Notification and acknowledgment
  notificationSent   Boolean   @default(false) @map("notification_sent")
  acknowledgedBy     String?   @map("acknowledged_by") @db.Uuid
  acknowledgedAt     DateTime? @map("acknowledged_at") @db.Timestamptz(6)
  acknowledgmentNotes String?   @map("acknowledgment_notes") @db.Text
  
  // External source reference
  externalSourceId  String  @map("external_source_id") @db.Uuid
  externalChangeId  String? @map("external_change_id") @db.VarChar(255)
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  
  // Relations
  opportunityProject OpportunityProject        @relation(fields: [opportunityProjectId], references: [id], onDelete: Cascade)
  externalSource     ExternalOpportunitySource @relation(fields: [externalSourceId], references: [id])
  acknowledgedByUser User?                     @relation("ChangeAcknowledger", fields: [acknowledgedBy], references: [id])
  
  @@index([opportunityProjectId, changeTimestamp(sort: Desc)])
  @@index([acknowledgedBy, acknowledgedAt])
  @@map("external_data_changes")
}
```

---

## 2. MIGRATION STRATEGY

### Initial Migration Setup

**Initial Migration Command:**
```bash
# Generate initial migration
npx prisma migrate dev --name init

# This creates:
# - prisma/migrations/20240101000000_init/migration.sql
# - Updates prisma/schema.prisma
# - Generates Prisma Client
```

**Production Migration:**
```bash
# Deploy to production
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

### Migration Best Practices

**1. Migration Naming Convention:**
```bash
# Feature additions
npx prisma migrate dev --name "add_opportunity_projects"

# Schema changes
npx prisma migrate dev --name "update_user_authentication"

# Performance improvements
npx prisma migrate dev --name "add_performance_indexes"

# Bug fixes
npx prisma migrate dev --name "fix_document_constraints"
```

**2. Safe Migration Practices:**
```sql
-- Always include IF NOT EXISTS for safety
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunity_projects_tenant_id 
ON opportunity_projects(tenant_id);

-- Add columns with defaults to avoid blocking
ALTER TABLE opportunity_projects 
ADD COLUMN IF NOT EXISTS version_hash VARCHAR(64) DEFAULT '';

-- Drop constraints safely
ALTER TABLE opportunity_projects 
DROP CONSTRAINT IF EXISTS opportunity_projects_title_check;
```

### Development Workflow Integration

**Package.json Scripts:**
```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:migrate:status": "prisma migrate status",
    "db:migrate:reset": "prisma migrate reset --force",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:pull": "prisma db pull",
    "db:push": "prisma db push"
  }
}
```

This comprehensive Prisma schema implementation provides a complete, production-ready database foundation for the GWM CRM system with full multi-tenant support, comprehensive audit trails, and enterprise-scale performance optimization.

**Ready for immediate implementation with proper migration management and development workflow integration!**