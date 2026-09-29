#!/usr/bin/env bash

# ==========================================================
#  Nuraiyan Social Network - Mac M-Series Production Runner
# ==========================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${CYAN}==========================================================${NC}"
echo -e "${YELLOW}   🚀 Nuraiyan Social Network - Production Local Runner    ${NC}"
echo -e "${CYAN}==========================================================${NC}"

cleanup() {
  echo -e "\n${YELLOW}Stopping servers...${NC}"
  kill 0
  wait
  exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}[1/2] Starting Backend Server (Port 5000)...${NC}"
(
  cd "$ROOT_DIR/backend"
  node dist/index.js
) &
BACKEND_PID=$!

echo -e "${GREEN}[2/2] Starting Frontend Next.js (Port 3000)...${NC}"
(
  cd "$ROOT_DIR/frontend"
  npx next start -p 3000
) &
FRONTEND_PID=$!

echo -e "\n${CYAN}==========================================================${NC}"
echo -e "${GREEN}✅ Production servers running!${NC}"
echo -e "   👉 Frontend : ${YELLOW}http://localhost:3000${NC}"
echo -e "   👉 Backend  : ${YELLOW}http://localhost:5001${NC}"
echo -e "   (Press ${RED}Ctrl + C${NC} to stop both servers)"
echo -e "${CYAN}==========================================================${NC}\n"

wait "$BACKEND_PID" "$FRONTEND_PID"
