#!/bin/sh
set -e

# Wait for database to be ready
echo "Waiting for database to be ready..."
until npx prisma db push --accept-data-loss > /dev/null 2>&1; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Optionally seed the database in development
if [ "$NODE_ENV" = "dev" ] || [ "$NODE_ENV" = "development" ]; then
  echo "Running database seeding..."
  npx prisma db seed || echo "Seeding failed or no seed script available"
fi

echo "Starting application..."
exec "$@"
