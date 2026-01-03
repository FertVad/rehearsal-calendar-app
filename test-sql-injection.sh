#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjcsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3Njc0Mjg3NTAsImV4cCI6MTc3MDAyMDc1MH0.2i20eFOu1allNy8ZZBUnaqQgobj1O52iDaiY1Z8rRdc"

echo "=== Test 1: Valid fields (weekStartDay, firstName) ==="
curl -X PUT http://localhost:3001/api/auth/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"weekStartDay":"sunday","firstName":"TestUser"}' \
  2>/dev/null | python3 -m json.tool

echo ""
echo "=== Test 2: Invalid field attempt (isAdmin - should be IGNORED) ==="
curl -X PUT http://localhost:3001/api/auth/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"weekStartDay":"monday","isAdmin":true,"firstName":"Hacker"}' \
  2>/dev/null | python3 -m json.tool

echo ""
echo "=== Test 3: Invalid weekStartDay value (should FAIL) ==="
curl -X PUT http://localhost:3001/api/auth/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"weekStartDay":"tuesday"}' \
  2>/dev/null | python3 -m json.tool
