#!/usr/bin/env bash

# Script to run Bun tests in isolation to work around mock.module() cross-contamination bug
# See: https://github.com/oven-sh/bun/issues/7823
# See: https://github.com/oven-sh/bun/issues/6040

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test pattern (default to "Unit", can be overridden)
TEST_PATTERN="${1:-Unit}"

# Counters
TOTAL_FILES=0
PASSED_FILES=0
FAILED_FILES=0
FAILED_FILES_LIST=()

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Running ${TEST_PATTERN} Tests in Isolation${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Find all test files (excluding integration tests)
TEST_FILES=$(find src -name '*.test.ts' -not -name '*.integration.test.ts' | sort)

# Count total files
TOTAL_FILES=$(echo "$TEST_FILES" | wc -l | tr -d ' ')

if [ "$TOTAL_FILES" -eq 0 ]; then
  echo -e "${YELLOW}No test files found matching pattern.${NC}"
  exit 0
fi

echo -e "${BLUE}Found ${TOTAL_FILES} test file(s) to run${NC}"
echo ""

# Run each test file individually
for test_file in $TEST_FILES; do
  echo -e "${BLUE}Running: ${test_file}${NC}"

  # Run the test and capture output
  if bun test "$test_file" --test-name-pattern "$TEST_PATTERN" 2>&1 | tee /tmp/test-output.txt; then
    echo -e "${GREEN}✓ PASSED: ${test_file}${NC}"
    PASSED_FILES=$((PASSED_FILES + 1))
  else
    echo -e "${RED}✗ FAILED: ${test_file}${NC}"
    FAILED_FILES=$((FAILED_FILES + 1))
    FAILED_FILES_LIST+=("$test_file")

    # Show the failure output
    echo -e "${RED}--- Error Output ---${NC}"
    cat /tmp/test-output.txt
    echo -e "${RED}--------------------${NC}"
  fi

  echo ""
done

# Print summary
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "Total test files: ${TOTAL_FILES}"
echo -e "${GREEN}Passed: ${PASSED_FILES}${NC}"
echo -e "${RED}Failed: ${FAILED_FILES}${NC}"
echo ""

# If there were failures, list them
if [ "$FAILED_FILES" -gt 0 ]; then
  echo -e "${RED}Failed test files:${NC}"
  for failed_file in "${FAILED_FILES_LIST[@]}"; do
    echo -e "${RED}  - ${failed_file}${NC}"
  done
  echo ""
  exit 1
fi

echo -e "${GREEN}All tests passed! ✨${NC}"
exit 0
