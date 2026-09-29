#!/usr/bin/env bash

# ==========================================================
#  Nuraiyan Social Network - Mac M-Series (Apple Silicon) Setup
# ==========================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${CYAN}==========================================================${NC}"
echo -e "${YELLOW}   🍏 Setting up Nuraiyan for macOS (Apple Silicon M-Series)   ${NC}"
echo -e "${CYAN}==========================================================${NC}"

echo -e "${GREEN}System Architecture:${NC} $(uname -m)"
echo -e "${GREEN}macOS Version:${NC} $(sw_vers -productVersion 2>/dev/null || uname -r)"
echo -e "${GREEN}Node.js Version:${NC} $(node -v)"
echo -e "${GREEN}npm Version:${NC} $(npm -v)"

# Step 1: Clean legacy Windows / corrupted node_modules & caches
echo -e "\n${YELLOW}[Step 1/4] Cleaning legacy Windows node_modules & Next.js cache...${NC}"
rm -rf "$ROOT_DIR/backend/node_modules"
rm -rf "$ROOT_DIR/frontend/node_modules"
rm -rf "$ROOT_DIR/frontend/.next"

# Step 2: Install backend dependencies on macOS ARM64
echo -e "\n${YELLOW}[Step 2/4] Installing backend dependencies natively on macOS...${NC}"
cd "$ROOT_DIR/backend"
npm install
npx prisma generate

# Step 3: Install frontend dependencies on macOS ARM64
echo -e "\n${YELLOW}[Step 3/4] Installing frontend dependencies natively on macOS...${NC}"
cd "$ROOT_DIR/frontend"
npm install

# Step 4: Ensure executable permissions on all binaries and scripts
echo -e "\n${YELLOW}[Step 4/4] Setting POSIX executable permissions...${NC}"
cd "$ROOT_DIR"
chmod +x "$ROOT_DIR"/*.sh 2>/dev/null || true
chmod +x "$ROOT_DIR/backend/node_modules/.bin/"* 2>/dev/null || true
chmod +x "$ROOT_DIR/frontend/node_modules/.bin/"* 2>/dev/null || true

echo -e "\n${CYAN}==========================================================${NC}"
echo -e "${GREEN}🎉 Mac M-Series setup completed successfully!${NC}"
echo -e "You can now run:"
echo -e "  👉 ${YELLOW}npm run dev${NC}  or  ${YELLOW}./start-dev.sh${NC}"
echo -e "${CYAN}==========================================================${NC}"
