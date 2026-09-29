# 🤖 Antigravity Multi-Agent Guidelines

## Active Workspace Information
- **Environment**: macOS Darwin ARM64 (Apple Silicon / Mac M-Series)
- **Primary Shell**: zsh / bash
- **Package Manager**: npm (Node.js v20+)
- **Workspace Root**: `/Users/raiyankhan/Library/CloudStorage/GoogleDrive-educationraiyan@gmail.com/My Drive/Project/Social_Network`

## Agent Operational Rules
1. **OS Compatibility**: Always generate macOS/POSIX-compatible commands and paths (`/`). Do not invoke Windows `.bat` or `.ps1` files.
2. **File Permissions**: After running npm install or creating scripts, preserve or grant executable bits (`chmod +x`).
3. **Architecture Consistency**: Ensure any native binary tools (Prisma, Argon2, SWC) target `darwin-arm64`.
4. **Development Workflow**:
   - Dev runner: `npm run dev` or `./start-dev.sh`
   - Services: PostgreSQL (`5432`), Redis (`6379`), Backend (`5001`), Frontend (`3000`)
