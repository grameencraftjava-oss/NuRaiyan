#!/usr/bin/env bash

# ==========================================================
#  Nuraiyan Social Network - Mac M-Series Dev Launcher
# ==========================================================

set -e

# Terminal colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${CYAN}==========================================================${NC}"
echo -e "${YELLOW}   🚀 Nuraiyan Social Network - Dev Server Launcher (Mac)  ${NC}"
echo -e "${CYAN}==========================================================${NC}"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}Error: Node.js is not installed or not in PATH.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Node.js version:${NC} $(node -v)"
echo -e "${GREEN}✓ Architecture:${NC} $(uname -m)"

# Optional: Check if Docker services are needed/running
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker is running.${NC}"
    # Check if postgres container is running
    if ! docker ps | grep -q "social_network_postgres"; then
      echo -e "${YELLOW}Starting PostgreSQL & Redis containers with Docker Compose...${NC}"
      (cd "$ROOT_DIR" && docker compose up -d) || true
    fi
  else
    echo -e "${YELLOW}Notice: Docker daemon is not active. If using local PostgreSQL/Redis, make sure they are running.${NC}"
  fi
fi

# Ensure binaries have executable permissions
chmod +x "$ROOT_DIR/backend/node_modules/.bin/"* 2>/dev/null || true
chmod +x "$ROOT_DIR/frontend/node_modules/.bin/"* 2>/dev/null || true

# Trap to gracefully terminate both background processes on Ctrl+C
cleanup() {
  echo -e "\n${YELLOW}Shutting down servers...${NC}"
  kill 0
  wait
  echo -e "${GREEN}Servers stopped cleanly.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "\n${GREEN}[1/2] Starting Backend Server (Port 5000)...${NC}"
(
  cd "$ROOT_DIR/backend"
  npm run dev
) &
BACKEND_PID=$!

echo -e "${GREEN}[2/2] Starting Frontend Next.js Server (Port 3000)...${NC}"
(
  cd "$ROOT_DIR/frontend"
  npm run dev
) &
FRONTEND_PID=$!

echo -e "\n${CYAN}==========================================================${NC}"
echo -e "${GREEN}✅ Servers are starting up!${NC}"
echo -e "   👉 Frontend : ${YELLOW}http://localhost:3000${NC}"
echo -e "   👉 Backend  : ${YELLOW}http://localhost:5001${NC}"
echo -e "   (Press ${RED}Ctrl + C${NC} to stop both servers)"
echo -e "${CYAN}==========================================================${NC}\n"

# Wait for both background jobs
wait "$BACKEND_PID" "$FRONTEND_PID"
