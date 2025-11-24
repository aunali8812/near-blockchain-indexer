#!/bin/bash
set -e

echo "Pushing database schema..."
npx prisma db push --accept-data-loss --skip-generate

echo "Checking if database needs seeding..."
if [ -n "$RUN_SEED" ] && [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database with initial data..."
  npm run seed
else
  echo "Skipping seed (set RUN_SEED=true to seed)"
fi

echo "Starting application..."
exec node dist/main.js
