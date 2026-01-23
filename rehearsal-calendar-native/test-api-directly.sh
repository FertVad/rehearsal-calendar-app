#!/bin/bash

# Get auth token for admin user (Jerusalem timezone)
echo "Getting auth token for admin (test1@mail.com)..."
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/native/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@mail.com","password":"password123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Failed to get admin token"
  exit 1
fi

echo "Admin token: ${ADMIN_TOKEN:0:20}..."
echo ""

# Get availability for project
echo "Fetching availability for project 3, date 2026-01-20..."
echo ""

curl -s -X GET "http://localhost:3001/api/native/projects/3/members/availability?date=2026-01-20" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "========================================"
echo ""

# Now test with Moscow user
echo "Getting auth token for Moscow user (test10@mail.com)..."
MOSCOW_TOKEN=$(curl -s -X POST http://localhost:3001/api/native/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test10@mail.com","password":"password123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$MOSCOW_TOKEN" ]; then
  echo "Failed to get Moscow token"
  exit 1
fi

echo "Moscow token: ${MOSCOW_TOKEN:0:20}..."
echo ""

echo "Fetching availability as Moscow user..."
echo ""

curl -s -X GET "http://localhost:3001/api/native/projects/3/members/availability?date=2026-01-20" \
  -H "Authorization: Bearer $MOSCOW_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
