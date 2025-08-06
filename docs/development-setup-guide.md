# Development Setup Guide - GWM CRM

---

## TABLE OF CONTENTS

### 1. PREREQUISITES
- System Requirements
- Required Software Installation
- Development Environment Setup

### 2. LOCAL DEVELOPMENT SETUP
- Repository Setup
- Docker Environment Configuration
- Database Setup and Migration
- Application Configuration

### 3. DEVELOPMENT WORKFLOW
- Daily Development Process
- Git Workflow and Branching Strategy
- Code Quality Standards
- Testing Procedures

### 4. DEVELOPMENT TOOLS
- VS Code Configuration
- Browser Extensions
- CLI Tools and Utilities
- Database Management Tools

### 5. TROUBLESHOOTING
- Common Issues and Solutions
- Performance Optimization
- Debugging Techniques

---

## 1. PREREQUISITES

### System Requirements

**Minimum Requirements:**
- **OS**: Windows 10/11, macOS 12+, or Linux (Ubuntu 20.04+)
- **CPU**: 4+ cores (Intel i5/AMD Ryzen 5 equivalent)
- **RAM**: 16GB minimum (32GB recommended)
- **Storage**: 50GB free space (SSD recommended)
- **Network**: Stable internet connection for API integrations

**Recommended Development Machine:**
- **CPU**: Intel i7/AMD Ryzen 7 (8+ cores)
- **RAM**: 32GB+ 
- **Storage**: 1TB+ NVMe SSD
- **Display**: 27"+ or dual monitors for productivity

### Required Software Installation

#### Core Development Tools

**1. Git (Latest Version)**
```bash
# Windows (using winget)
winget install Git.Git

# macOS (using Homebrew)
brew install git

# Linux (Ubuntu)
sudo apt update && sudo apt install git
```

**2. Node.js 18+ with npm**
```bash
# Install Node Version Manager (recommended)
# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Windows (using nvm-windows)
# Download from: https://github.com/coreybutler/nvm-windows

# Install and use Node.js 18
nvm install 18
nvm use 18

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x+
```

**3. Docker Desktop**
```bash
# Download from: https://www.docker.com/products/docker-desktop
# Follow platform-specific installation instructions

# Verify installation
docker --version
docker-compose --version
```

**4. Visual Studio Code**
```bash
# Download from: https://code.visualstudio.com/
# Install platform-specific version
```

#### Database Tools

**1. pgAdmin (PostgreSQL GUI)**
```bash
# Download from: https://www.pgadmin.org/download/
# Or use web version via Docker
```

**2. Redis CLI**
```bash
# macOS
brew install redis

# Ubuntu
sudo apt install redis-tools

# Windows (via WSL or download)
```

---

## 2. LOCAL DEVELOPMENT SETUP

### Repository Setup

**1. Clone the Repository**
```bash
# Clone the main repository
git clone https://github.com/company/gwm-crm.git
cd gwm-crm

# Set up remote branches
git remote -v
git branch -a
```

**2. Install Dependencies**
```bash
# Install Node.js dependencies
npm install

# Verify package installation
npm ls
```

### Docker Environment Configuration

**3. Development Environment with Docker Compose**

Create `docker-compose.dev.yml`:
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: gwm_crm_dev
      POSTGRES_USER: gwm_user
      POSTGRES_PASSWORD: gwm_password
      POSTGRES_PORT: 5432
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    command: >
      postgres 
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.track=all
      -c max_connections=200

  # pgBouncer Connection Pooler
  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    restart: always
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: gwm_user
      DATABASES_PASSWORD: gwm_password
      DATABASES_DBNAME: gwm_crm_dev
      POOL_MODE: transaction
      SERVER_RESET_QUERY: DISCARD ALL
      MAX_CLIENT_CONN: 100
      DEFAULT_POOL_SIZE: 20
    ports:
      - "6432:6432"
    depends_on:
      - postgres

  # Redis Cache
  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio:latest
    restart: always
    environment:
      MINIO_ROOT_USER: gwm_minio_user
      MINIO_ROOT_PASSWORD: gwm_minio_password
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  # Development database GUI
  pgadmin:
    image: dpage/pgadmin4:latest
    restart: always
    environment:
      PGADMIN_DEFAULT_EMAIL: dev@gwm-crm.com
      PGADMIN_DEFAULT_PASSWORD: gwm_admin_password
    ports:
      - "8080:80"
    volumes:
      - pgadmin_data:/var/lib/pgadmin

  # Redis GUI
  redis-commander:
    image: rediscommander/redis-commander:latest
    restart: always
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
  minio_data:
  pgadmin_data:
```

**4. Environment Variables**

Create `.env.local`:
```bash
# Database Configuration
DATABASE_URL="postgresql://gwm_user:gwm_password@localhost:6432/gwm_crm_dev"
DATABASE_DIRECT_URL="postgresql://gwm_user:gwm_password@localhost:5432/gwm_crm_dev"

# Redis Configuration
REDIS_URL="redis://localhost:6379"

# MinIO S3 Configuration
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="gwm_minio_user"
S3_SECRET_KEY="gwm_minio_password"
S3_BUCKET_NAME="gwm-crm-dev"
S3_REGION="us-east-1"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-development-secret-key-here"

# Application Configuration
NODE_ENV="development"
APP_ENV="development"
LOG_LEVEL="debug"

# Multi-tenant Configuration
DEFAULT_TENANT_ID="dev-tenant-001"
ENABLE_MULTI_TENANT="true"

# Feature Flags
ENABLE_AI_FEATURES="false"
ENABLE_EXTERNAL_API_SYNC="true"
ENABLE_AUDIT_LOGGING="true"

# External API Configuration (Development)
INTERNAL_API_BASE_URL="https://dev-api.company.com/v1"
INTERNAL_API_KEY="dev-api-key"
POLLING_INTERVAL_MINUTES="60"

# Email Configuration (Development)
EMAIL_FROM="dev@gwm-crm.com"
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASSWORD=""

# Monitoring and Observability
ENABLE_METRICS="true"
SENTRY_DSN=""
```

**5. Start Development Environment**
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Database Setup and Migration

**6. Prisma Database Setup**
```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate:dev

# Seed development data
npm run db:seed

# View database with Prisma Studio
npm run db:studio
```

**7. Database Migration Commands**
```bash
# Create new migration
npm run db:migrate:dev --name "add-new-feature"

# Reset database (development only)
npm run db:reset

# Deploy migrations (production)
npm run db:deploy

# Check migration status
npm run db:migrate:status
```

### Application Configuration

**8. Start Development Server**
```bash
# Start Next.js development server
npm run dev

# Start with specific port
npm run dev -- --port 3001

# Start with debug mode
npm run dev:debug
```

**9. Verify Development Setup**

Open these URLs to verify everything is working:

- **Application**: http://localhost:3000
- **pgAdmin**: http://localhost:8080 (dev@gwm-crm.com / gwm_admin_password)
- **Redis Commander**: http://localhost:8081
- **MinIO Console**: http://localhost:9001 (gwm_minio_user / gwm_minio_password)
- **Prisma Studio**: http://localhost:5555 (after running `npm run db:studio`)

---

## 3. DEVELOPMENT WORKFLOW

### Daily Development Process

**Morning Startup Routine:**
```bash
# 1. Update repository
git pull origin develop

# 2. Install any new dependencies
npm install

# 3. Start development services
docker-compose -f docker-compose.dev.yml up -d

# 4. Run database migrations (if any)
npm run db:migrate:dev

# 5. Start development server
npm run dev

# 6. Run tests in watch mode (separate terminal)
npm run test:watch
```

**Development Process:**
1. Create feature branch from `develop`
2. Write failing tests (TDD approach)
3. Implement feature with type-safe code
4. Ensure all tests pass
5. Run code quality checks
6. Create pull request for review

### Git Workflow and Branching Strategy

**Branch Naming Convention:**
```bash
# Feature branches
feature/GWM-123-opportunity-management
feature/GWM-456-document-upload

# Bug fix branches
fix/GWM-789-login-redirect-issue
fix/GWM-101-performance-optimization

# Release branches
release/v1.2.0

# Hotfix branches
hotfix/v1.1.1-security-patch
```

**Git Commands Workflow:**
```bash
# Create new feature branch
git checkout develop
git pull origin develop
git checkout -b feature/GWM-123-opportunity-management

# Daily work routine
git add .
git commit -m "feat(opportunities): add opportunity project creation

- Implement OpportunityProject model
- Add tRPC router for CRUD operations
- Include comprehensive validation
- Add unit tests with 90% coverage

Closes GWM-123"

# Push and create PR
git push origin feature/GWM-123-opportunity-management
# Create pull request via GitHub CLI or web interface

# Clean up after merge
git checkout develop
git pull origin develop
git branch -d feature/GWM-123-opportunity-management
```

### Code Quality Standards

**Pre-commit Checks:**
```bash
# Install husky for git hooks
npm install --save-dev husky lint-staged

# Setup pre-commit hook
npx husky add .husky/pre-commit "npm run lint-staged"
```

**Package.json scripts:**
```json
{
  "scripts": {
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "lint-staged": "lint-staged"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --findRelatedTests --passWithNoTests"
    ],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

**Code Quality Checklist:**
- ✅ TypeScript strict mode compliance
- ✅ ESLint errors resolved
- ✅ Prettier formatting applied
- ✅ Unit tests written and passing
- ✅ Integration tests for API changes
- ✅ Type safety maintained end-to-end

### Testing Procedures

**Testing Strategy Implementation:**

**1. Unit Tests (Jest + Testing Library)**
```typescript
// tests/lib/opportunity-service.test.ts
import { OpportunityService } from '~/lib/services/opportunity-service'
import { prismaMock } from '~/tests/__mocks__/prisma'

jest.mock('~/lib/prisma', () => ({ prisma: prismaMock }))

describe('OpportunityService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createOpportunityProject', () => {
    it('should create opportunity project with valid data', async () => {
      const mockProject = {
        id: 'test-id',
        tenantId: 'tenant-123',
        projectName: 'Test Project',
        projectStatus: 'active'
      }

      prismaMock.opportunityProject.create.mockResolvedValue(mockProject)

      const result = await OpportunityService.createOpportunityProject({
        tenantId: 'tenant-123',
        projectName: 'Test Project',
        externalSourceId: 'source-123',
        externalOpportunityId: 'opp-456'
      })

      expect(result).toEqual(mockProject)
      expect(prismaMock.opportunityProject.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectName: 'Test Project'
        })
      })
    })
  })
})
```

**2. Integration Tests**
```typescript
// tests/api/opportunity-projects.test.ts
import { createTRPCContext } from '~/server/api/trpc'
import { appRouter } from '~/server/api/root'

describe('/api/trpc/opportunityProjects', () => {
  it('should create opportunity project via API', async () => {
    const ctx = await createTRPCContext({
      req: mockRequest,
      res: mockResponse
    })

    const caller = appRouter.createCaller(ctx)

    const result = await caller.opportunityProjects.create({
      projectName: 'Integration Test Project',
      externalSourceId: 'source-123',
      externalOpportunityId: 'opp-789'
    })

    expect(result.projectName).toBe('Integration Test Project')
  })
})
```

**3. E2E Tests (Playwright)**
```typescript
// tests/e2e/opportunity-management.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Opportunity Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    await page.fill('[data-testid=email]', 'test@gwm-crm.com')
    await page.fill('[data-testid=password]', 'testpassword')
    await page.click('[data-testid=login-button]')
  })

  test('should create new opportunity project', async ({ page }) => {
    await page.goto('http://localhost:3000/opportunities')
    await page.click('[data-testid=create-opportunity-button]')
    
    await page.fill('[data-testid=project-name]', 'E2E Test Project')
    await page.selectOption('[data-testid=external-source]', 'source-123')
    await page.fill('[data-testid=external-opportunity-id]', 'e2e-opp-123')
    
    await page.click('[data-testid=save-button]')
    
    await expect(page.locator('[data-testid=success-message]')).toBeVisible()
    await expect(page.locator('text=E2E Test Project')).toBeVisible()
  })
})
```

---

## 4. DEVELOPMENT TOOLS

### VS Code Configuration

**Recommended Extensions:**
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-playwright.playwright",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-docker",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

**VS Code Settings (.vscode/settings.json):**
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

**Launch Configuration (.vscode/launch.json):**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Next.js",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Browser Extensions

**Chrome/Edge Extensions for Development:**
- **React Developer Tools** - Component tree inspection
- **Redux DevTools** - State management debugging
- **Prisma Studio** - Database inspection
- **Web Vitals** - Performance monitoring
- **axe DevTools** - Accessibility testing

### CLI Tools and Utilities

**Essential CLI Tools:**
```bash
# GitHub CLI
gh --version

# Prisma CLI
npx prisma --version

# TypeScript CLI
npx tsc --version

# Playwright CLI
npx playwright --version

# Docker CLI
docker --version

# Kubernetes CLI (for production deployment)
kubectl version --client
```

**Useful Development Commands:**
```bash
# Database operations
npm run db:studio          # Open Prisma Studio
npm run db:seed            # Seed development data
npm run db:reset           # Reset development database

# Testing
npm run test:unit          # Run unit tests
npm run test:integration   # Run integration tests
npm run test:e2e          # Run E2E tests
npm run test:coverage     # Generate coverage report

# Code quality
npm run lint              # Run ESLint
npm run type-check        # Check TypeScript types
npm run format           # Format with Prettier

# Build and deployment
npm run build            # Production build
npm run start            # Start production server
npm run analyze          # Bundle analyzer
```

---

## 5. TROUBLESHOOTING

### Common Issues and Solutions

**1. Database Connection Issues**
```bash
# Check if PostgreSQL container is running
docker-compose -f docker-compose.dev.yml ps postgres

# Check container logs
docker-compose -f docker-compose.dev.yml logs postgres

# Reset database connection
docker-compose -f docker-compose.dev.yml restart postgres
npm run db:migrate:dev
```

**2. Node Modules Issues**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force

# Check for peer dependency issues
npm ls
```

**3. TypeScript Compilation Errors**
```bash
# Check TypeScript configuration
npx tsc --showConfig

# Regenerate types
npm run db:generate
npm run type-check

# Clear Next.js cache
rm -rf .next
npm run dev
```

**4. Docker Issues**
```bash
# Reset Docker environment
docker-compose -f docker-compose.dev.yml down -v
docker system prune -a
docker-compose -f docker-compose.dev.yml up -d

# Check Docker resources
docker system df
docker stats
```

### Performance Optimization

**Development Performance Tips:**

**1. Next.js Optimization**
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons'],
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js'
        }
      }
    }
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Optimize for development
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  }
}
```

**2. Database Performance**
```bash
# Monitor database performance
docker exec -it gwm_postgres psql -U gwm_user -d gwm_crm_dev -c "
  SELECT query, calls, total_time, mean_time 
  FROM pg_stat_statements 
  ORDER BY total_time DESC 
  LIMIT 10;
"

# Analyze slow queries
npm run db:studio
# Use query analyzer in Prisma Studio
```

### Debugging Techniques

**1. Application Debugging**
```typescript
// Debug API requests
import { logger } from '~/lib/logger'

export const debugMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now()
  const result = await next()
  const durationMs = Date.now() - start

  logger.debug('tRPC call', {
    path,
    type,
    durationMs,
    success: result.ok
  })

  return result
})
```

**2. Database Query Debugging**
```typescript
// Enable Prisma query logging
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
})

prisma.$on('query', (e) => {
  console.log('Query: ' + e.query)
  console.log('Params: ' + e.params)
  console.log('Duration: ' + e.duration + 'ms')
})
```

**3. Frontend State Debugging**
```typescript
// Redux DevTools for Zustand
import { devtools } from 'zustand/middleware'

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // ... store implementation
    }),
    {
      name: 'gwm-crm-store',
    }
  )
)
```

### Getting Help

**Documentation Resources:**
- **Internal Wiki**: `http://localhost:3000/docs`
- **API Documentation**: `http://localhost:3000/api/docs`
- **Database Schema**: `http://localhost:5555` (Prisma Studio)

**Team Communication:**
- **Slack Channel**: #gwm-crm-development
- **Daily Standups**: 9:00 AM EST
- **Technical Reviews**: Wednesday 2:00 PM EST

**Emergency Contacts:**
- **Tech Lead**: [tech-lead@company.com]
- **DevOps Lead**: [devops@company.com]
- **Database Admin**: [dba@company.com]

---

This comprehensive development setup guide provides everything needed to get productive on the GWM CRM project quickly and efficiently. The setup emphasizes type safety, code quality, and developer experience while maintaining the high standards required for FedRAMP compliance.

**Ready to onboard new developers with a complete, tested development environment!**