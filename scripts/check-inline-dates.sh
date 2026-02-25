#!/bin/bash
# CI check: Catch inline payroll logic outside shared date helpers.
# Run: bash scripts/check-inline-dates.sh (or: npm run lint:dates)
#
# This prevents regressions where developers add new inline
# `if (day >= 15)` payroll-period calculations instead of importing
# from the canonical shared helpers.

set -euo pipefail

ALLOWED_FILES="(_shared/date-helpers\.ts|lib/calculations/dates\.ts)"

# Search for inline payroll-period patterns in relevant directories
MATCHES=$(grep -rn -E "if \((day|currentDay|d) >= 15\)" \
  supabase/functions/ src/ \
  --include="*.ts" --include="*.tsx" \
  2>/dev/null \
  | grep -v -E "$ALLOWED_FILES" \
  | grep -v "node_modules" \
  || true)

if [ -n "$MATCHES" ]; then
  echo "❌ Inline payroll-logik fundet udenfor shared helpers:"
  echo ""
  echo "$MATCHES"
  echo ""
  echo "Brug i stedet:"
  echo "  Frontend: import { getPayrollPeriod } from '@/lib/calculations/dates';"
  echo "  Backend:  import { getPayrollPeriod } from '../_shared/date-helpers.ts';"
  exit 1
fi

echo "✅ Ingen inline payroll-logik fundet udenfor shared helpers"
