#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# James's Laser Clinic — One-Command Local Setup
# Usage: chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  James's Laser Clinic — Local Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── Step 1: Check prerequisites ───────────────────────────────────────────────
echo -e "\n${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org${NC}"
  exit 1
fi
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}✗ Node.js 18+ required. Current: $(node -v)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}  pnpm not found. Installing...${NC}"
  npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm $(pnpm -v)${NC}"

# ── Step 2: Check .env ────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[2/5] Checking environment configuration...${NC}"

if [ ! -f ".env" ]; then
  if [ -f "local-env-template.txt" ]; then
    cp local-env-template.txt .env
    echo -e "${YELLOW}  Created .env from template.${NC}"
    echo -e "${RED}  ⚠ IMPORTANT: Edit .env and set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD${NC}"
    echo -e "${RED}  Then re-run this script.${NC}"
    exit 1
  else
    echo -e "${RED}✗ No .env file found. Create one from local-env-template.txt${NC}"
    exit 1
  fi
fi

# Check required vars
source .env 2>/dev/null || true
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}✗ DATABASE_URL not set in .env${NC}"
  exit 1
fi
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "replace_with_64_char_random_hex_string" ]; then
  echo -e "${YELLOW}  Generating JWT_SECRET...${NC}"
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  # Replace the placeholder in .env
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
  else
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
  fi
  echo -e "${GREEN}✓ JWT_SECRET generated${NC}"
fi
echo -e "${GREEN}✓ .env configured${NC}"

# ── Step 3: Install dependencies ──────────────────────────────────────────────
echo -e "\n${YELLOW}[3/5] Installing dependencies...${NC}"
pnpm install --frozen-lockfile 2>&1 | tail -5
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ── Step 4: Run database migrations ──────────────────────────────────────────
echo -e "\n${YELLOW}[4/5] Running database migrations...${NC}"
pnpm drizzle-kit migrate 2>&1 | tail -10
echo -e "${GREEN}✓ Database migrations complete${NC}"

# ── Step 5: Seed admin user ───────────────────────────────────────────────────
echo -e "\n${YELLOW}[5/5] Creating admin user...${NC}"
node seed-admin.mjs 2>&1
echo -e "${GREEN}✓ Admin user ready${NC}"

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Run the app:    ${YELLOW}pnpm dev${NC}"
echo -e "  Open browser:   ${YELLOW}http://localhost:3000${NC}"
echo -e "  Login page:     ${YELLOW}http://localhost:3000/login${NC}"
echo -e "  Admin email:    ${YELLOW}${ADMIN_EMAIL:-admin@yourdomain.com}${NC}"
echo ""
