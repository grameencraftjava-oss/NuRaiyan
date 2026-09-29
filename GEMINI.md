# 🚀 Nuraiyan (নূরাইয়ান) - Antigravity Agent Guidelines

This project was originally bootstrapped on Windows and is now actively developed on **macOS (Apple Silicon / Mac M-Series)**.
Antigravity must adhere to the following environment, architectural, and operational rules.

---

## 💻 Environment & Host Platform

- **Operating System**: macOS (Darwin ARM64 / Apple Silicon M-Series)
- **Shell**: `zsh` / `bash`
- **Node.js**: v20+ with `npm`
- **Path Separators**: Always use POSIX forward slashes `/` and Node's `path.join()`.
- **Scripts**: Execute shell scripts (`./start-dev.sh`, `./start-local.sh`, `./setup-mac.sh`) or `npm run <script>`.
  > ⚠️ **NEVER** attempt to run `.bat` or `.ps1` scripts on this Mac.

---

## 🏗️ Project Architecture & Services

| Component | Technology | Directory | Default Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router) + TS + Tailwind | `/frontend` | `3000` | UI, WebRTC calling, Video, Chat, Stories |
| **Backend** | Express + TypeScript + Prisma + Socket.io | `/backend` | `5001` | REST API, WebSockets, JWT Auth, Uploads (Port 5001 avoids macOS AirPlay conflict) |
| **Database** | PostgreSQL 16 | Docker Compose | `5432` | Relational data model via Prisma ORM |
| **Cache/TTL** | Redis 7 | Docker Compose | `6379` | Stories expiry, Socket.io state |
| **Document DB** | MongoDB 7 | Docker Compose | `27017` | Optional document storage & logs |

---

## 🛠️ Common Commands

- **Run Dev Environment**:
  ```bash
  ./start-dev.sh
  # or
  npm run dev
  ```
- **Backend Only**:
  ```bash
  cd backend && npm run dev
  ```
- **Frontend Only**:
  ```bash
  cd frontend && npm run dev
  ```
- **Docker Services**:
  ```bash
  docker compose up -d
  ```
- **Prisma Migrations & Generation**:
  ```bash
  cd backend && npx prisma generate
  cd backend && npx prisma migrate dev
  ```
- **Mac Clean Setup (when switching or syncing)**:
  ```bash
  ./setup-mac.sh
  ```

---

## 🔒 Security & Code Standards

1. **Password Hashing**: Always use `argon2id` via the auth service.
2. **File Permissions**: Always ensure binaries in `node_modules/.bin/` and `.sh` scripts have execution permissions (`chmod +x`).
3. **Prisma Binary Targets**: Retain `binaryTargets = ["native", "darwin-arm64"]` in `backend/prisma/schema.prisma`.
4. **CORS & CSRF**: All mutating endpoints require origin checking (`security.middleware.ts`). Allowed local origins: `http://localhost:3000` and `http://127.0.0.1:3000`.
5. **Clean Syncing**: Never track or commit `node_modules`, `.next`, `dist`, `.DS_Store`, or `.env` files.
