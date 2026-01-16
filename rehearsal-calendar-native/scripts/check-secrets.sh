#!/bin/bash
# Secret Scanner - Prevents committing sensitive data
# This script checks for common secret patterns in tracked files

set -e

echo "🔍 Scanning for exposed secrets in tracked files..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Get list of tracked files (excluding .gitignore'd files)
TRACKED_FILES=$(git ls-files)

# Patterns to search for (case-insensitive)
declare -a PATTERNS=(
  "DATABASE_URL=postgresql://"
  "DATABASE_URL=postgres://"
  "TELEGRAM_BOT_TOKEN=[0-9]"
  "JWT_SECRET=[a-zA-Z0-9\-_]{20,}"
  "sk-[a-zA-Z0-9]{20,}"
  "pk_live_[a-zA-Z0-9]"
  "PRIVATE_KEY="
  "API_KEY=[a-zA-Z0-9]{20,}"
  "Bearer [a-zA-Z0-9]{20,}"
  "password=.{8,}"
)

# Patterns that are allowed in .example files
declare -a EXAMPLE_PATTERNS=(
  "DATABASE_URL=postgresql://user:password@host"
  "JWT_SECRET=your-"
  "JWT_SECRET=$"
  "JWT_SECRET=.*\|\|"
  "TELEGRAM_BOT_TOKEN=your-"
  "TELEGRAM_BOT_TOKEN=$"
)

echo "Checking ${#PATTERNS[@]} secret patterns..."
echo ""

for PATTERN in "${PATTERNS[@]}"; do
  # Search in tracked files
  MATCHES=$(echo "$TRACKED_FILES" | xargs grep -i -n "$PATTERN" 2>/dev/null || true)

  if [ -n "$MATCHES" ]; then
    # Filter out .example files, .md files (documentation), and code files with fallback patterns
    FILTERED_MATCHES=""

    while IFS= read -r line; do
      FILE=$(echo "$line" | cut -d':' -f1)

      # Skip .example files
      if [[ "$FILE" == *.example* ]]; then
        continue
      fi

      # Skip .md files (documentation)
      if [[ "$FILE" == *.md ]]; then
        continue
      fi

      # Skip if it's a fallback pattern in code (e.g., process.env.JWT_SECRET || 'default')
      SKIP=0
      for EXAMPLE_PATTERN in "${EXAMPLE_PATTERNS[@]}"; do
        if echo "$line" | grep -q -i "$EXAMPLE_PATTERN"; then
          SKIP=1
          break
        fi
      done

      if [ $SKIP -eq 0 ]; then
        FILTERED_MATCHES+="$line"$'\n'
      fi
    done <<< "$MATCHES"

    if [ -n "$FILTERED_MATCHES" ]; then
      echo -e "${RED}❌ FOUND: Pattern '$PATTERN' in tracked files:${NC}"
      echo "$FILTERED_MATCHES" | sed 's/^/   /'
      echo ""
      FAILED=1
    fi
  fi
done

# Check for .env files in tracked files
ENV_FILES=$(echo "$TRACKED_FILES" | grep -E "(^|/)\.env($|\.)" | grep -v ".env.example" || true)
if [ -n "$ENV_FILES" ]; then
  echo -e "${RED}❌ FOUND: .env files in tracked files:${NC}"
  echo "$ENV_FILES" | sed 's/^/   /'
  echo ""
  FAILED=1
fi

# Summary
if [ $FAILED -eq 1 ]; then
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}⛔ SECRET SCAN FAILED!${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Secrets detected in tracked files. Please:"
  echo "1. Remove sensitive values from tracked files"
  echo "2. Use .env files (ignored by git) for secrets"
  echo "3. Run: git rm --cached <file> to untrack files"
  echo ""
  echo -e "${YELLOW}📖 See SECURITY_INSTRUCTIONS.md for details${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ SECRET SCAN PASSED!${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "No secrets found in tracked files."
  echo ""
  exit 0
fi
