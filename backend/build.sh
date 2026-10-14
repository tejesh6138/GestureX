#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Collecting static files..."
python manage.py collectstatic --no-input

echo "==> Running database migrations on Neon PostgreSQL..."
python manage.py migrate --no-input

echo "==> Build complete!"
