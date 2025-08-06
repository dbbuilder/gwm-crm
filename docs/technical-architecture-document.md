# Technical Architecture Document - GWM CRM

---

## TABLE OF CONTENTS

### 1. ARCHITECTURE OVERVIEW
- System Context & Design Philosophy
- Technology Stack Rationale
- High-Level Architecture Diagram

### 2. DATABASE LAYER (PostgreSQL + pgBouncer)
- PostgreSQL Configuration for Enterprise Scale
- pgBouncer Connection Pooling Strategy
- Multi-Tenant Data Architecture
- Performance Optimization

### 3. ORM LAYER (Prisma)
- Prisma Schema Design
- Multi-Tenant Configuration
- Query Optimization Strategies
- Database Migration Management

### 4. API LAYER (tRPC)
- tRPC Router Architecture
- Type-Safe API Design
- Authentication & Authorization Middleware
- Rate Limiting & Security

### 5. FRONTEND (React + shadcn/ui)
- React Application Architecture
- State Management Strategy
- Component Design System
- Performance Optimization

### 6. INFRASTRUCTURE & DEPLOYMENT
- Cloud-Agnostic Architecture
- Container Strategy (Docker/Kubernetes)
- CI/CD Pipeline
- Monitoring & Observability

### 7. SECURITY ARCHITECTURE
- FedRAMP Compliance Implementation
- Authentication & Authorization Flow
- Data Encryption & Key Management
- Audit Logging Architecture

### 8. INTEGRATION ARCHITECTURE
- Internal API Integration Patterns
- File Storage & Document Management
- Background Job Processing
- Event-Driven Architecture

### 9. PERFORMANCE & SCALABILITY
- Horizontal Scaling Strategy
- Caching Architecture
- Database Optimization
- Frontend Performance

### 10. DEVELOPMENT WORKFLOW
- Local Development Setup
- Testing Strategy
- Code Quality & Standards
- Deployment Process

---

## 1. ARCHITECTURE OVERVIEW

### System Context & Design Philosophy

The GWM CRM is designed as a **cloud-native, multi-tenant SaaS** application following **modern microservices principles** while maintaining **monolithic simplicity** for faster development and easier maintenance.

**Core Design Principles:**
- **FedRAMP Compliance First**: All architectural decisions prioritize security and compliance
- **Type Safety**: End-to-end type safety from database to frontend
- **Performance**: Enterprise-scale performance (500+ users, 1000+ projects per tenant)
- **Developer Experience**: Fast development cycles with excellent tooling
- **Operational Simplicity**: Easy to deploy, monitor, and maintain

### Technology Stack Rationale

```mermaid
graph TB
    Client[React + shadcn/ui] --> Gateway[Load Balancer]
    Gateway --> App[Next.js Application]
    App --> API[tRPC Routers]
    API --> ORM[Prisma ORM]
    ORM --> Pool[pgBouncer]
    Pool --> DB[(PostgreSQL)]
    App --> Cache[Redis Cache]
    App --> Storage[S3-Compatible Storage]
    App --> Queue[Background Jobs]
```

**Technology Choices:**

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React + Next.js + shadcn/ui | Type-safe, performant, excellent DX, SSR capabilities |
| **API** | tRPC | End-to-end type safety, excellent TypeScript integration |
| **ORM** | Prisma | Type-safe database access, excellent migration tools |
| **Database** | PostgreSQL 15+ | ACID compliance, JSON support, enterprise features |
| **Connection Pool** | pgBouncer | High-performance connection pooling for enterprise scale |
| **Cache** | Redis | Session management, query caching, rate limiting |
| **Storage** | S3-Compatible | Scalable file storage with encryption support |
| **Runtime** | Node.js 18+ | Modern runtime with excellent TypeScript support |

---

## 2. DATABASE LAYER (PostgreSQL + pgBouncer)

### PostgreSQL Configuration for Enterprise Scale

**Core Configuration (`postgresql.conf`):**
```ini
# Connection and Authentication
max_connections = 200                    # Limited, pgBouncer handles pooling
shared_preload_libraries = 'pg_stat_statements'

# Memory Configuration (for 16GB+ server)
shared_buffers = 4GB                     # 25% of RAM
effective_cache_size = 12GB              # 75% of RAM
work_mem = 64MB                          # Per connection
maintenance_work_mem = 512MB
random_page_cost = 1.1                   # For SSD storage

# Write Ahead Logging
wal_buffers = 16MB
checkpoint_completion_target = 0.9
wal_level = replica
archive_mode = on
archive_command = '/path/to/archive/script %f %p'

# Query Planning
default_statistics_target = 100
constraint_exclusion = partition

# Logging for FedRAMP Compliance
log_destination = 'csvlog'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'all'                    # Log all statements for audit
log_min_duration_statement = 1000       # Log slow queries
log_connections = on
log_disconnections = on
log_checkpoints = on
```

**Security Configuration (`pg_hba.conf`):**
```
# FedRAMP compliant authentication
hostssl all all 0.0.0.0/0 md5 clientcert=1
hostnossl all all all reject
```

### pgBouncer Connection Pooling Strategy

**pgBouncer Configuration (`pgbouncer.ini`):**
```ini
[databases]
govwin_crm = host=postgresql-server port=5432 dbname=govwin_crm user=app_user

[pgbouncer]
# Connection Pool Configuration
pool_mode = transaction                   # Best for web applications
max_client_conn = 1000                   # Support 500+ concurrent users
default_pool_size = 25                   # Per database pool size
min_pool_size = 5                        # Minimum connections
reserve_pool_size = 5                    # Emergency connections
max_db_connections = 200                 # Total PostgreSQL connections

# Performance Tuning
server_round_robin = 1                   # Load balancing
server_idle_timeout = 600               # 10 minutes
server_lifetime = 3600                  # 1 hour
server_connect_timeout = 15
query_timeout = 300                     # 5 minutes
query_wait_timeout = 120                # 2 minutes

# Security
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
ignore_startup_parameters = extra_float_digits

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
syslog = 1
syslog_facility = local0
```

**Connection Pool Strategy:**
```typescript
// Database connection configuration
export const databaseConfig = {
  // pgBouncer connection for application
  DATABASE_URL: "postgresql://app_user:password@pgbouncer:6432/govwin_crm",
  
  // Direct connection for migrations and admin tasks
  DATABASE_ADMIN_URL: "postgresql://admin_user:password@postgres:5432/govwin_crm",
  
  // Connection pool settings
  connectionLimit: 25,
  idleTimeout: 600,
  acquireTimeout: 60000,
  
  // Multi-tenant query settings
  statementTimeout: 30000, // 30 seconds
  queryTimeout: 120000,    // 2 minutes for complex reports
}
```

---

## 3. ORM LAYER (Prisma)

### Prisma Schema Design

**Core Schema Structure (`schema.prisma`):**
```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["multiSchema", "relationJoins"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DATABASE_ADMIN_URL") // For migrations
}

// Multi-tenant base model
model Tenant {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String   @db.VarChar(255)
  subdomain String   @unique @db.VarChar(100)
  planType  String   @map("plan_type") @db.VarChar(50)
  maxUsers  Int      @default(100) @map("max_users")
  maxOpportunityProjects Int @default(500) @map("max_opportunity_projects")
  isActive  Boolean  @default(true) @map("is_active")
  fedrampCompliant Boolean @default(false) @map("fedramp_compliant")
  
  subscriptionStatus String? @map("subscription_status") @db.VarChar(50)
  subscriptionExpiresAt DateTime? @map("subscription_expires_at") @db.Timestamptz
  billingEmail String? @map("billing_email") @db.VarChar(255)
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdBy String?  @map("created_by") @db.Uuid
  updatedBy String?  @map("updated_by") @db.Uuid
  
  // Relations
  users                    User[]
  opportunityProjects     OpportunityProject[]
  organizations           Organization[]
  documents               Document[]
  activities              Activity[]
  auditLogs               AuditLog[]
  roles                   Role[]
  externalOpportunitySources ExternalOpportunitySource[]
  
  @@map("tenants")
}

// User model with comprehensive RBAC
model User {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  
  // Authentication
  email         String    @db.VarChar(255)
  passwordHash  String?   @map("password_hash") @db.VarChar(255)
  isSamlUser    Boolean   @default(false) @map("is_saml_user")
  samlId        String?   @map("saml_id") @db.VarChar(255)
  
  // Profile
  firstName String  @map("first_name") @db.VarChar(100)
  lastName  String  @map("last_name") @db.VarChar(100)
  title     String? @db.VarChar(150)
  phone     String? @db.VarChar(50)
  avatarUrl String? @map("avatar_url") @db.VarChar(500)
  
  // Account status
  isActive        Boolean   @default(true) @map("is_active")
  emailVerified   Boolean   @default(false) @map("email_verified")
  lastLoginAt     DateTime? @map("last_login_at") @db.Timestamptz
  passwordChangedAt DateTime @default(now()) @map("password_changed_at") @db.Timestamptz
  
  // Security
  failedLoginAttempts Int       @default(0) @map("failed_login_attempts")
  lockedUntil         DateTime? @map("locked_until") @db.Timestamptz
  mfaEnabled          Boolean   @default(false) @map("mfa_enabled")
  mfaSecretEncrypted  String?   @map("mfa_secret_encrypted") @db.Text
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdBy String?  @map("created_by") @db.Uuid
  
  // Relations
  tenant              Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userRoles          UserRole[]
  opportunityProjectsAsManager OpportunityProject[] @relation("CaptureManager")
  opportunityProjectsAsProposal OpportunityProject[] @relation("ProposalManager")
  documents          Document[]
  activities         Activity[]
  auditLogs          AuditLog[]
  userSessions       UserSession[]
  
  @@unique([tenantId, email])
  @@map("users")
}

// Opportunity Project (core entity)
model OpportunityProject {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid
  
  // Project identification
  projectName String @map("project_name") @db.VarChar(255)
  internalReferenceNumber String? @map("internal_reference_number") @db.VarChar(100)
  
  // External source linkage
  externalSourceId String @map("external_source_id") @db.Uuid
  externalOpportunityId String @map("external_opportunity_id") @db.VarChar(255)
  externalOpportunityUrl String? @map("external_opportunity_url") @db.VarChar(1000)
  
  // Basic opportunity data
  solicitationNumber String? @map("solicitation_number") @db.VarChar(100)
  agencyName String? @map("agency_name") @db.VarChar(255)
  contractingOffice String? @map("contracting_office") @db.VarChar(255)
  title String? @db.VarChar(500)
  description String? @db.Text
  
  // Project management
  projectStatus String @default("active") @map("project_status") @db.VarChar(50)
  pipelineStage String @default("phase_0") @map("pipeline_stage") @db.VarChar(50)
  priorityLevel String @default("medium") @map("priority_level") @db.VarChar(20)
  
  // Scoring
  winProbabilityScore Decimal? @map("win_probability_score") @db.Decimal(5,2)
  strategicValueScore Decimal? @map("strategic_value_score") @db.Decimal(5,2)
  pursuitHealthScore Decimal? @map("pursuit_health_score") @db.Decimal(5,2)
  
  // Team assignments
  assignedCaptureManagerId String? @map("assigned_capture_manager") @db.Uuid
  assignedProposalManagerId String? @map("assigned_proposal_manager") @db.Uuid
  assignedTeamMembers Json @default("[]") @map("assigned_team_members")
  
  // Synchronization
  lastSyncedAt DateTime? @map("last_synced_at") @db.Timestamptz
  syncStatus String @default("pending") @map("sync_status") @db.VarChar(50)
  syncErrorMessage String? @map("sync_error_message") @db.Text
  versionHash String? @map("version_hash") @db.VarChar(64)
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdBy String @map("created_by") @db.Uuid
  
  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  externalSource ExternalOpportunitySource @relation(fields: [externalSourceId], references: [id])
  captureManager User? @relation("CaptureManager", fields: [assignedCaptureManagerId], references: [id])
  proposalManager User? @relation("ProposalManager", fields: [assignedProposalManagerId], references: [id])
  
  externalOpportunityData ExternalOpportunityData[]
  opportunityProjectOverrides OpportunityProjectOverride[]
  documents Document[]
  activities Activity[] @relation("ProjectActivities")
  contacts OpportunityProjectContact[]
  pollingConfigurations PollingConfiguration[]
  externalDataChanges ExternalDataChange[]
  
  @@unique([tenantId, externalSourceId, externalOpportunityId])
  @@map("opportunity_projects")
}

// Additional models following the same pattern...
// (Document, Activity, AuditLog, etc. - abbreviated for brevity)
```

### Multi-Tenant Configuration

**Prisma Client Extension for Multi-Tenancy:**
```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { AsyncLocalStorage } from 'async_hooks'

// Context storage for tenant isolation
export const tenantContext = new AsyncLocalStorage<{
  tenantId: string
  userId: string
}>()

// Extended Prisma client with multi-tenant middleware
export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
}).$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = tenantContext.getStore()
        
        if (!context) {
          throw new Error('No tenant context found')
        }
        
        // Automatically add tenant filter for all queries
        if ('where' in args) {
          args.where = {
            ...args.where,
            tenantId: context.tenantId,
          }
        } else if (operation === 'create' || operation === 'createMany') {
          if ('data' in args) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(item => ({
                ...item,
                tenantId: context.tenantId,
              }))
            } else {
              args.data = {
                ...args.data,
                tenantId: context.tenantId,
              }
            }
          }
        }
        
        return query(args)
      },
    },
  },
})

// Type-safe tenant-aware Prisma client
export type PrismaClientExtended = typeof prisma
```

### Query Optimization Strategies

**Optimized Query Patterns:**
```typescript
// lib/queries/opportunity-projects.ts
export class OpportunityProjectQueries {
  // Optimized dashboard query with joins
  static async getDashboardData(tenantId: string, userId: string) {
    return tenantContext.run({ tenantId, userId }, async () => {
      return prisma.opportunityProject.findMany({
        select: {
          id: true,
          projectName: true,
          pipelineStage: true,
          winProbabilityScore: true,
          lastSyncedAt: true,
          captureManager: {
            select: { firstName: true, lastName: true }
          },
          externalOpportunityData: {
            where: { isCurrentVersion: true },
            select: {
              title: true,
              estimatedValueMax: true,
              responseDueDate: true,
              solicitationStatus: true,
            },
            take: 1,
          },
          _count: {
            select: {
              documents: true,
              activities: true,
            }
          }
        },
        where: {
          projectStatus: 'active',
        },
        orderBy: {
          updatedAt: 'desc'
        },
      })
    })
  }
  
  // Batch update with optimistic locking
  static async updateProjectScores(updates: Array<{
    id: string
    winProbabilityScore: number
    strategicValueScore: number
    versionHash: string
  }>) {
    return prisma.$transaction(
      updates.map(update => 
        prisma.opportunityProject.update({
          where: { 
            id: update.id,
            versionHash: update.versionHash // Optimistic locking
          },
          data: {
            winProbabilityScore: update.winProbabilityScore,
            strategicValueScore: update.strategicValueScore,
            versionHash: generateVersionHash(),
          }
        })
      )
    )
  }
}
```

---

## 4. API LAYER (tRPC)

### tRPC Router Architecture

**Router Structure (`server/api/root.ts`):**
```typescript
import { createTRPCRouter } from "~/server/api/trpc"
import { opportunityProjectRouter } from "./routers/opportunity-project"
import { externalDataRouter } from "./routers/external-data"
import { documentRouter } from "./routers/document"
import { userRouter } from "./routers/user"
import { activityRouter } from "./routers/activity"
import { analyticsRouter } from "./routers/analytics"
import { pollingRouter } from "./routers/polling"

export const appRouter = createTRPCRouter({
  // Core business entities
  opportunityProjects: opportunityProjectRouter,
  externalData: externalDataRouter,
  documents: documentRouter,
  users: userRouter,
  activities: activityRouter,
  
  // Advanced features
  analytics: analyticsRouter,
  polling: pollingRouter,
  
  // System management
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
```

**Opportunity Project Router (`routers/opportunity-project.ts`):**
```typescript
import { z } from "zod"
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc"
import { OpportunityProjectQueries } from "~/lib/queries/opportunity-projects"
import { TRPCError } from "@trpc/server"

// Input validation schemas
const createOpportunityProjectSchema = z.object({
  projectName: z.string().min(1).max(255),
  externalSourceId: z.string().uuid(),
  externalOpportunityId: z.string().min(1).max(255),
  externalOpportunityUrl: z.string().url().optional(),
  priorityLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
})

const updateOpportunityProjectSchema = z.object({
  id: z.string().uuid(),
  projectName: z.string().min(1).max(255).optional(),
  pipelineStage: z.enum([
    'phase_0', 'phase_1', 'phase_2', 'phase_3', 
    'phase_4', 'phase_5', 'phase_6', 'awarded', 'lost'
  ]).optional(),
  winProbabilityScore: z.number().min(0).max(100).optional(),
  strategicValueScore: z.number().min(0).max(100).optional(),
  assignedCaptureManagerId: z.string().uuid().optional(),
  assignedProposalManagerId: z.string().uuid().optional(),
  versionHash: z.string(), // For optimistic locking
})

export const opportunityProjectRouter = createTRPCRouter({
  // Create new opportunity project
  create: protectedProcedure
    .input(createOpportunityProjectSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await tenantContext.run(
          { tenantId: ctx.user.tenantId, userId: ctx.user.id },
          async () => {
            // Validate external source exists and user has access
            const externalSource = await prisma.externalOpportunitySource.findFirst({
              where: {
                id: input.externalSourceId,
                isActive: true,
              }
            })
            
            if (!externalSource) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'External opportunity source not found'
              })
            }
            
            // Check for duplicate
            const existing = await prisma.opportunityProject.findFirst({
              where: {
                externalSourceId: input.externalSourceId,
                externalOpportunityId: input.externalOpportunityId,
              }
            })
            
            if (existing) {
              throw new TRPCError({
                code: 'CONFLICT',
                message: 'Opportunity project already exists'
              })
            }
            
            // Create the project
            return await prisma.opportunityProject.create({
              data: {
                ...input,
                internalReferenceNumber: generateReferenceNumber(),
                versionHash: generateVersionHash(),
                createdBy: ctx.user.id,
              },
              include: {
                captureManager: {
                  select: { firstName: true, lastName: true, email: true }
                },
                externalSource: {
                  select: { sourceName: true, apiVersion: true }
                }
              }
            })
          }
        )
      } catch (error) {
        // Log error for monitoring
        await logError(error, { operation: 'createOpportunityProject', input })
        throw error
      }
    }),

  // Get opportunity projects for dashboard
  getDashboard: protectedProcedure
    .input(z.object({
      pipelineStage: z.string().optional(),
      assignedToMe: z.boolean().default(false),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return OpportunityProjectQueries.getDashboardData(
        ctx.user.tenantId, 
        ctx.user.id
      )
    }),

  // Update opportunity project
  update: protectedProcedure
    .input(updateOpportunityProjectSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, versionHash, ...updateData } = input
      
      try {
        return await tenantContext.run(
          { tenantId: ctx.user.tenantId, userId: ctx.user.id },
          async () => {
            const updated = await prisma.opportunityProject.update({
              where: { 
                id,
                versionHash, // Optimistic locking
              },
              data: {
                ...updateData,
                versionHash: generateVersionHash(),
                updatedBy: ctx.user.id,
              },
              include: {
                captureManager: {
                  select: { firstName: true, lastName: true }
                }
              }
            })
            
            // Log the change for audit
            await logAuditEvent({
              userId: ctx.user.id,
              entityType: 'opportunity_project',
              entityId: id,
              actionType: 'update',
              beforeValues: input,
              afterValues: updated,
            })
            
            return updated
          }
        )
      } catch (error) {
        if (error.code === 'P2025') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Opportunity project was modified by another user'
          })
        }
        throw error
      }
    }),

  // Import from external system
  importFromExternal: protectedProcedure
    .input(z.object({
      externalSourceId: z.string().uuid(),
      externalOpportunityId: z.string(),
      projectName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // This would trigger the external API sync
      return await ExternalSyncService.importOpportunity(input)
    }),

  // Get change history
  getChangeHistory: protectedProcedure
    .input(z.object({
      opportunityProjectId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      return prisma.changeHistory.findMany({
        where: {
          entityType: 'opportunity_project',
          entityId: input.opportunityProjectId,
        },
        orderBy: { changeTimestamp: 'desc' },
        take: input.limit,
        include: {
          changedByUser: {
            select: { firstName: true, lastName: true }
          }
        }
      })
    }),

  // Sync with external system
  syncWithExternal: protectedProcedure
    .input(z.object({
      opportunityProjectId: z.string().uuid(),
      forceSync: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      return await ExternalSyncService.syncOpportunityProject(
        input.opportunityProjectId,
        input.forceSync
      )
    }),
})
```

### Authentication & Authorization Middleware

**tRPC Context & Middleware (`server/api/trpc.ts`):**
```typescript
import { type CreateNextContextOptions } from "@trpc/server/adapters/next"
import { type Session } from "next-auth"
import { getServerAuthSession } from "~/server/auth"
import { prisma } from "~/lib/prisma"
import jwt from "jsonwebtoken"

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts
  
  // Get session from NextAuth or JWT token
  const session = await getServerAuthSession({ req, res })
  
  return {
    prisma,
    session,
    req,
    res,
  }
}

// Authentication middleware
const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  
  // Verify user is active
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    include: {
      tenant: true,
      userRoles: {
        include: { role: true }
      }
    }
  })
  
  if (!user || !user.isActive || !user.tenant.isActive) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      user,
    },
  })
})

// Role-based authorization middleware
const enforceUserHasRole = (requiredRoles: string[]) => 
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }
    
    const userRoles = ctx.user.userRoles.map(ur => ur.role.name)
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role))
    
    if (!hasRequiredRole) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }
    
    return next({ ctx })
  })

// Permission-based authorization middleware
const enforceUserHasPermission = (permission: string) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }
    
    const hasPermission = ctx.user.userRoles.some(ur => 
      ur.role.permissions.includes(permission) ||
      ur.role.permissions.includes('admin.all')
    )
    
    if (!hasPermission) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }
    
    return next({ ctx })
  })

// Rate limiting middleware
const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const key = `rate_limit:${ctx.user?.id || ctx.req.ip}`
  const limit = ctx.user ? 1000 : 100 // Higher limit for authenticated users
  const window = 3600 // 1 hour
  
  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, window)
  }
  
  if (current > limit) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS" })
  }
  
  return next({ ctx })
})

// Procedure builders
export const publicProcedure = t.procedure.use(rateLimitMiddleware)
export const protectedProcedure = t.procedure
  .use(rateLimitMiddleware)
  .use(enforceUserIsAuthed)
export const adminProcedure = protectedProcedure
  .use(enforceUserHasRole(['System Administrator', 'Tenant Administrator']))
```

---

## 5. FRONTEND (React + shadcn/ui)

### React Application Architecture

**Application Structure:**
```
src/
├── app/                     # Next.js 13+ app router
│   ├── (auth)/             # Authentication routes
│   ├── (dashboard)/        # Main application routes
│   ├── api/                # API routes (for non-tRPC endpoints)
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── forms/              # Form components
│   ├── data-tables/        # Table components
│   ├── charts/             # Chart components
│   └── layouts/            # Layout components
├── lib/
│   ├── api.ts              # tRPC client setup
│   ├── auth.ts             # Authentication utilities
│   ├── utils.ts            # Utility functions
│   └── validations.ts      # Zod schemas
├── hooks/                  # Custom React hooks
├── stores/                 # State management
├── types/                  # TypeScript definitions
└── styles/                 # CSS and styling
```

**Main Layout (`app/layout.tsx`):**
```typescript
import { Inter } from 'next/font/google'
import { TRPCReactProvider } from '~/lib/api'
import { Toaster } from '~/components/ui/toaster'
import { ThemeProvider } from '~/components/theme-provider'
import { AuthProvider } from '~/components/auth-provider'
import { TenantProvider } from '~/components/tenant-provider'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system">
          <TRPCReactProvider>
            <AuthProvider>
              <TenantProvider>
                {children}
                <Toaster />
              </TenantProvider>
            </AuthProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Dashboard Layout (`app/(dashboard)/layout.tsx`):**
```typescript
'use client'

import { useState } from 'react'
import { Sidebar } from '~/components/layouts/sidebar'
import { Header } from '~/components/layouts/header'
import { cn } from '~/lib/utils'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className={cn(
          "flex-1 overflow-auto p-6 transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}
```

### State Management Strategy

**Zustand Store for Global State:**
```typescript
// stores/app-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  tenantId: string
}

interface AppState {
  // Authentication
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  
  // UI State
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  currentTenant: string | null
  setCurrentTenant: (tenantId: string) => void
  
  // Application state
  selectedOpportunityProject: string | null
  setSelectedOpportunityProject: (id: string | null) => void
  
  // Notifications
  notifications: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    timestamp: Date
  }>
  addNotification: (notification: Omit<AppState['notifications'][0], 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      sidebarCollapsed: false,
      currentTenant: null,
      selectedOpportunityProject: null,
      notifications: [],
      
      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setCurrentTenant: (tenantId) => set({ currentTenant: tenantId }),
      setSelectedOpportunityProject: (id) => set({ selectedOpportunityProject: id }),
      
      addNotification: (notification) => {
        const newNotification = {
          ...notification,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        }
        set({ 
          notifications: [...get().notifications, newNotification] 
        })
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          get().removeNotification(newNotification.id)
        }, 5000)
      },
      
      removeNotification: (id) => {
        set({ 
          notifications: get().notifications.filter(n => n.id !== id) 
        })
      },
    }),
    {
      name: 'gwm-crm-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        currentTenant: state.currentTenant,
      }),
    }
  )
)
```

### Component Design System

**Opportunity Project Card Component:**
```typescript
// components/opportunity-projects/project-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Calendar, DollarSign, User, AlertTriangle } from 'lucide-react'
import { cn } from '~/lib/utils'

interface OpportunityProjectCardProps {
  project: {
    id: string
    projectName: string
    pipelineStage: string
    winProbabilityScore: number | null
    captureManager: { firstName: string; lastName: string } | null
    externalOpportunityData: Array<{
      title: string
      estimatedValueMax: number | null
      responseDueDate: Date | null
      solicitationStatus: string
    }>
    hasRecentChanges: boolean
  }
  onSelect: (id: string) => void
  className?: string
}

const PIPELINE_STAGE_COLORS = {
  phase_0: 'bg-gray-100 text-gray-800',
  phase_1: 'bg-blue-100 text-blue-800',
  phase_2: 'bg-purple-100 text-purple-800',
  phase_3: 'bg-yellow-100 text-yellow-800',
  phase_4: 'bg-orange-100 text-orange-800',
  phase_5: 'bg-red-100 text-red-800',
  phase_6: 'bg-green-100 text-green-800',
  awarded: 'bg-green-200 text-green-900',
  lost: 'bg-gray-200 text-gray-700',
}

export function OpportunityProjectCard({ 
  project, 
  onSelect, 
  className 
}: OpportunityProjectCardProps) {
  const latestData = project.externalOpportunityData[0]
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        project.hasRecentChanges && "ring-2 ring-blue-500 ring-opacity-50",
        className
      )}
      onClick={() => onSelect(project.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium line-clamp-2">
            {project.projectName}
          </CardTitle>
          <div className="flex items-center space-x-2 ml-4">
            {project.hasRecentChanges && (
              <AlertTriangle className="h-4 w-4 text-blue-500" />
            )}
            <Badge 
              variant="secondary" 
              className={PIPELINE_STAGE_COLORS[project.pipelineStage]}
            >
              {project.pipelineStage.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>
        {latestData?.title && (
          <p className="text-sm text-gray-600 line-clamp-2 mt-2">
            {latestData.title}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {latestData?.estimatedValueMax && (
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">
                ${(latestData.estimatedValueMax / 1000000).toFixed(1)}M
              </span>
            </div>
          )}
          
          {project.winProbabilityScore && (
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-gradient-to-r from-red-500 to-green-500 relative">
                <div 
                  className="absolute top-0 left-0 h-full bg-white rounded-full"
                  style={{ 
                    width: `${100 - project.winProbabilityScore}%`,
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <span className="text-gray-600">
                {project.winProbabilityScore}% P-Win
              </span>
            </div>
          )}
          
          {latestData?.responseDueDate && (
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className={cn(
                "text-gray-600",
                new Date(latestData.responseDueDate) < new Date() && "text-red-600 font-medium"
              )}>
                {new Date(latestData.responseDueDate).toLocaleDateString()}
              </span>
            </div>
          )}
          
          {project.captureManager && (
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600 truncate">
                {project.captureManager.firstName} {project.captureManager.lastName}
              </span>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          <Badge variant="outline" className="text-xs">
            {latestData?.solicitationStatus || 'Unknown Status'}
          </Badge>
          <Button variant="ghost" size="sm" className="text-xs">
            View Details →
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

This technical architecture document provides a comprehensive blueprint for implementing the GWM CRM with modern, scalable technologies. The architecture ensures FedRAMP compliance, enterprise performance, and excellent developer experience while maintaining the flexibility to scale and adapt to changing requirements.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Read and analyze existing PDF and video documentation", "status": "completed", "id": "1"}, {"content": "Create project folder structure (/project, /docs, /research)", "status": "completed", "id": "2"}, {"content": "Research DelTek GovWin CRM online for additional requirements", "status": "completed", "id": "3"}, {"content": "Synthesize research data and create comprehensive requirements document", "status": "completed", "id": "4"}, {"content": "Identify critical requirement gaps and questions", "status": "completed", "id": "5"}, {"content": "Research software requirements best practices for CRM/API integration projects", "status": "completed", "id": "6"}, {"content": "Implement answered questions into comprehensive requirements", "status": "completed", "id": "7"}, {"content": "Create document structure recommendation", "status": "completed", "id": "8"}, {"content": "Improve section delineation in comprehensive document", "status": "completed", "id": "9"}, {"content": "Design PostgreSQL data model with solid file structure", "status": "completed", "id": "10"}, {"content": "Create comprehensive technical architecture document", "status": "completed", "id": "11"}]