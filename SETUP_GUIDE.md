# Hospitality Order Management System - Local Development Setup Guide

## Overview

This guide explains how to run the frontend (Next.js) and backend (Django) separately on your local machine without Docker.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend       │
│   (Next.js)     │────▶│   (Django)      │
│   Port: 3000    │     │   Port: 8000    │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
             ┌─────────────┐           ┌─────────────┐
             │ PostgreSQL  │           │    Redis    │
             │  Port: 5432 │           │  Port: 6379 │
             └─────────────┘           └─────────────┘
```

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Python | 3.12+ | Backend runtime |
| Node.js | 22+ | Frontend runtime |
| pnpm | 9+ | Frontend package manager |
| PostgreSQL | 16+ | Primary database |
| Redis | 7+ | Caching & WebSocket channels |

### Verify Installation

```powershell
python --version      # Should be 3.12+
node --version        # Should be 22+
pnpm --version        # Should be 9+
psql --version        # PostgreSQL client
redis-cli --version   # Redis client
```

## Database Setup

### PostgreSQL

1. **Install PostgreSQL** (if not already installed):
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Or use winget: `winget install PostgreSQL.PostgreSQL`

2. **Create database and user**:
   ```powershell
   # Connect to PostgreSQL as superuser
   psql -U postgres
   
   # In psql shell:
   CREATE DATABASE restaurant;
   CREATE USER postgres WITH PASSWORD 'postgres';
   GRANT ALL PRIVILEGES ON DATABASE restaurant TO postgres;
   \q
   ```

3. **Verify connection**:
   ```powershell
   psql -U postgres -d restaurant -c "SELECT version();"
   ```

### Redis

1. **Install Redis** (if not already installed):
   - Windows: Use WSL2 with Ubuntu, or Memurai (Redis-compatible)
   - Or use winget: `winget install Redis.Redis`

2. **Start Redis server**:
   ```powershell
   # If installed as service
   net start redis
   
   # Or run directly
   redis-server
   ```

3. **Verify connection**:
   ```powershell
   redis-cli ping
   # Should return: PONG
   ```

## Backend Setup

### Option 1: Using the Startup Script (Recommended)

```powershell
# From project root
.\start-backend.ps1
```

### Option 2: Manual Setup

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
venv\Scripts\Activate.ps1

# 4. Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 5. Ensure .env file exists (created automatically by script)
# Check backend/.env has correct values for local development

# 6. Run migrations
python manage.py migrate --noinput

# 7. (Optional) Create superuser
python manage.py createsuperuser

# 8. Start development server
python manage.py runserver 8000
```

### Backend Environment Variables (`backend/.env`)

```env
DJANGO_SECRET_KEY=dev-secret-key-for-local-development-only
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
POSTGRES_DB=restaurant
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
CORS_ALLOWED_ORIGINS=http://localhost:3000
EMAIL_PROVIDER=unconfigured
WHATSAPP_PROVIDER=unconfigured
```

### Backend Endpoints

| Endpoint | URL | Description |
|----------|-----|-------------|
| GraphQL API | http://localhost:8000/graphql/ | Main API endpoint |
| GraphQL Playground | http://localhost:8000/graphql/ | Interactive API explorer |
| WebSocket | ws://localhost:8000/ws/operations/ | Real-time updates |
| Django Admin | http://localhost:8000/admin/ | Admin interface (if enabled) |

## Frontend Setup

### Option 1: Using the Startup Script (Recommended)

```powershell
# From project root
.\start-frontend.ps1
```

### Option 2: Manual Setup

```powershell
# 1. From project root (where package.json is)
# 2. Install dependencies
pnpm install

# 3. Ensure .env.local exists (created automatically by script)
# Check .env.local has correct values

# 4. Start development server
pnpm dev
```

### Frontend Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/graphql/
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/operations/
```

### Frontend Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | http://localhost:3000 | Main dashboard |
| Orders | http://localhost:3000/orders | Order management |
| Kitchen | http://localhost:3000/kitchen | Kitchen display |
| Menu | http://localhost:3000/menu | Menu management |
| Billing | http://localhost:3000/billing | Billing & invoices |
| Requests | http://localhost:3000/requests | Service requests |
| Team | http://localhost:3000/team | Team management |
| Login | http://localhost:3000/login | Authentication |

## Running Both Services

### Terminal 1 - Backend
```powershell
.\start-backend.ps1
```

### Terminal 2 - Frontend
```powershell
.\start-frontend.ps1
```

### Terminal 3 - Background Worker (Optional)
```powershell
cd backend
venv\Scripts\Activate.ps1
python manage.py process_notifications
```

## Troubleshooting

### Backend Issues

**Database connection failed**
```
Error: could not connect to server: Connection refused
```
- Ensure PostgreSQL is running: `net start postgresql-x64-16` (service name may vary)
- Check `POSTGRES_HOST` and `POSTGRES_PORT` in `backend/.env`
- Verify database exists: `psql -U postgres -d restaurant -c "\l"`

**Redis connection failed**
```
Error: Connection refused
```
- Ensure Redis is running: `redis-cli ping`
- Check `REDIS_HOST` and `REDIS_PORT` in `backend/.env`

**Module not found errors**
```
ModuleNotFoundError: No module named 'xxx'
```
- Ensure virtual environment is activated
- Reinstall dependencies: `pip install -r requirements.txt`

**Migration errors**
```
django.db.utils.OperationalError: relation "xxx" does not exist
```
- Run migrations: `python manage.py migrate --noinput`
- If persistent, reset: `python manage.py migrate --fake-initial`

### Frontend Issues

**API connection failed**
```
Error: Failed to fetch / GraphQL request failed
```
- Ensure backend is running on port 8000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS settings in backend `.env`

**WebSocket connection failed**
```
WebSocket connection to 'ws://localhost:8000/ws/operations/' failed
```
- Ensure backend is running
- Check `NEXT_PUBLIC_WS_URL` in `.env.local`
- Verify Django Channels is configured correctly

**Build errors**
```
Error: Module not found: Can't resolve 'xxx'
```
- Clear cache: `rm -rf .next node_modules && pnpm install`
- Check for TypeScript errors: `pnpm build`

### Port Conflicts

If ports 3000, 8000, 5432, or 6379 are in use:

```powershell
# Find process using port
netstat -ano | findstr :3000
netstat -ano | findstr :8000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

## Development Workflow

### Making Backend Changes

1. Edit Python files in `backend/`
2. Changes auto-reload with `runserver`
3. For model changes: `python manage.py makemigrations && python manage.py migrate`

### Making Frontend Changes

1. Edit TypeScript/React files in `app/`, `components/`, `lib/`
2. Changes auto-reload with `pnpm dev`
3. For new dependencies: `pnpm add <package>`

### Running Tests

```powershell
# Backend tests
cd backend
venv\Scripts\Activate.ps1
python manage.py test

# Frontend tests (if configured)
pnpm test
```

## Production Deployment

For production, use the provided Docker setup:

```powershell
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Useful Commands

### Backend
```powershell
# Create new app
python manage.py startapp <app_name>

# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Shell access
python manage.py shell

# Collect static files
python manage.py collectstatic

# Run specific test
python manage.py test orders.tests.OrderTestCase
```

### Frontend
```powershell
# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Type check
pnpm tsc --noEmit
```

## File Structure Reference

```
hospitality-order-management-system/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/       # Dashboard layout & pages
│   ├── login/             # Authentication
│   └── globals.css        # Global styles
├── backend/               # Django project
│   ├── config/            # Django settings & URLs
│   ├── core/              # Core functionality
│   ├── orders/            # Order management
│   ├── billing/           # Billing & invoices
│   ├── hotel/             # Hotel integration
│   ├── identity/          # User management
│   ├── notifications/     # Notification system
│   ├── reporting/         # Reports & analytics
│   └── venue_platform/    # Venue management
├── components/            # React components
├── lib/                   # Frontend utilities
├── infra/docker/          # Docker files
├── start-backend.ps1      # Backend startup script
├── start-frontend.ps1     # Frontend startup script
├── backend/.env           # Backend environment
├── .env.local             # Frontend environment
└── docker-compose.yml     # Docker orchestration
```

## Support

For issues:
1. Check the troubleshooting section above
2. Verify all prerequisites are installed
3. Check service logs for error messages
4. Ensure environment variables are correctly set

---

**Last Updated**: 2026-08-22
**Version**: 1.0