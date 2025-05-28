#!/bin/bash

set -e

echo "Starting production deployment..."

echo "Updating submodules..."
git submodule update --remote --recursive

echo "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

echo "Building and starting production containers..."
docker compose -f docker-compose.prod.yml up --build -d

echo "Production deployment completed successfully!" 