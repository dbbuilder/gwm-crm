# GWM CRM - Government Opportunity Management System

A comprehensive, modern CRM system designed specifically for government contracting opportunity management. Built with cutting-edge technologies to provide a cost-effective alternative to expensive legacy solutions while maintaining enterprise-grade functionality and FedRAMP compliance.

## 🎯 Project Overview

**GWM CRM** is a multi-tenant SaaS opportunity management platform that enables government contractors to effectively track selected pursuits from initial selection through award. The system provides seamless integration with internal opportunity intelligence APIs and comprehensive workflow automation for pursuit management.

### Key Features

- 🏢 **Multi-tenant SaaS Architecture** - Supports 500+ users per tenant
- 🔒 **FedRAMP Compliant** - Government-grade security and compliance
- 🔄 **External API Integration** - Continuous sync with opportunity sources
- 📊 **Visual Pipeline Management** - Kanban-style pursuit tracking for 1000+ projects
- 📁 **Integrated Document Management** - Hybrid internal/external document handling
- 🤖 **AI-Powered Capabilities** - Smart scoring and predictive analytics
- ⚡ **Modern Technology Stack** - PostgreSQL, Prisma, tRPC, React, shadcn/ui

## 🏗️ Architecture

### Technology Stack
- **Database**: PostgreSQL 15+ with pgBouncer connection pooling
- **ORM**: Prisma with TypeScript for type-safe operations
- **API**: tRPC for end-to-end type safety
- **Frontend**: React 18+ with Next.js and shadcn/ui
- **Authentication**: NextAuth.js with RBAC
- **Storage**: S3-compatible file storage
- **Cache**: Redis for session management

### System Requirements
- **Scale**: 500+ concurrent users per tenant
- **Performance**: < 200ms API response times
- **Availability**: 99.9% uptime with disaster recovery
- **Compliance**: FedRAMP Moderate baseline controls

## 📁 Project Structure

```
/project/
├── docs/                               # Comprehensive documentation
│   ├── comprehensive-requirements-document.md    # 73-page requirements spec
│   ├── postgresql-data-model.md                  # Complete database design
│   ├── technical-architecture-document.md       # Full-stack architecture
│   ├── implementation-roadmap.md                # 18-month development plan
│   ├── development-setup-guide.md               # Developer environment setup
│   └── prisma-schema-implementation.md          # Database implementation
├── schema.prisma                      # Complete Prisma database schema
└── README.md                         # This file
```

## 🚀 Key Differentiators

### Opportunity Management Focus
- **NOT a master opportunities database** - Manages selected opportunities as trackable projects
- **Internal API Integration** - Synchronizes with company opportunity intelligence platform
- **Version-based Conflict Resolution** - Maintains complete change history
- **Continuous Synchronization** - Hourly polling with intelligent change detection

### Enterprise Features
- **Multi-tenant Isolation** - Per-tenant data security and credential management
- **Comprehensive RBAC** - 7 distinct role levels with granular permissions
- **Complete Audit Trails** - Every action logged for compliance requirements
- **FedRAMP Security Controls** - Government-grade security implementation

### Modern User Experience
- **Dashboard-Centric Design** - Personalized portal with KPI roll-ups
- **Lifecycle Kanban Views** - Visual pursuit pipeline (Phases 0-6)
- **Real-time Updates** - Live notifications and status indicators
- **Mobile-First Design** - Progressive web app with offline capabilities

## 📋 Documentation

### Core Documents
1. **[Comprehensive Requirements](docs/comprehensive-requirements-document.md)** - Complete functional and technical specifications
2. **[Database Design](docs/postgresql-data-model.md)** - Multi-tenant PostgreSQL schema with 20+ entities
3. **[Technical Architecture](docs/technical-architecture-document.md)** - Full-stack implementation design
4. **[Implementation Roadmap](docs/implementation-roadmap.md)** - 18-month phased development plan
5. **[Development Setup](docs/development-setup-guide.md)** - Complete environment configuration

### Key Features Documented
- External API integration requirements and polling strategies
- Multi-tenant data architecture with Row Level Security (RLS)
- Comprehensive audit logging for FedRAMP compliance
- Document management with internal/external synchronization
- AI-powered capabilities and workflow automation
- Performance requirements for enterprise scale (500+ users, 1000+ projects)

## 🎯 Target Market

- **Enterprise Government Contractors** (500+ employees)
- **Defense Contractors** requiring FedRAMP compliance
- **High-Volume Pursuit Organizations** (1000+ concurrent projects)
- **Companies with Enterprise Authentication** (SAML integration)
- **Organizations Needing Comprehensive Audit Trails**

## 🔒 Security & Compliance

### FedRAMP Requirements
- **Moderate Baseline Controls** - Full NIST SP 800-53 compliance
- **Continuous Monitoring** - Ongoing security assessment
- **Data Residency** - FedRAMP authorized facilities only
- **Audit Requirements** - Complete activity logging and retention

### Additional Compliance
- **NIST SP 800-171** - CUI handling requirements
- **SOC 2 Type II** - Security and availability controls
- **FISMA Compliance** - Federal information security requirements
- **Export Control** - ITAR/EAR compliance capabilities

## 🚀 Getting Started

### Prerequisites
- Docker Desktop
- Node.js 18+
- PostgreSQL 15+
- Git

### Quick Setup
```bash
# Clone the repository
git clone https://github.com/dbbuilder/gwm-crm.git
cd gwm-crm

# Follow the development setup guide
# See docs/development-setup-guide.md for complete instructions
```

## 📊 Success Metrics

### Business Goals
- **50-70% cost savings** compared to DelTek GovWin
- **80% user adoption** within 6 months
- **10% win rate improvement** for customers
- **99.9% uptime** with enterprise reliability

### Technical Targets
- **< 200ms API response times** for 95% of requests
- **1000+ concurrent projects** per tenant support
- **500+ concurrent users** per tenant capacity
- **Zero critical security incidents**

## 🤝 Contributing

This project follows enterprise development practices:
- **Test-Driven Development** - Tests written before implementation
- **Type Safety** - End-to-end TypeScript implementation
- **Code Quality** - ESLint, Prettier, and pre-commit hooks
- **Security First** - Security considerations in all decisions

## 📄 License

This project is proprietary and confidential. All rights reserved.

---

**Built with modern technologies for government contractors who demand excellence.**

🔗 **Repository**: https://github.com/dbbuilder/gwm-crm
📧 **Contact**: For inquiries about this project