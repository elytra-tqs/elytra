#!/bin/bash

set -e

echo "=== Elytra Production Deployment Started ==="
echo "Timestamp: $(date)"

echo "Checking Docker availability..."
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "Error: Docker Compose is not available"
    exit 1
fi

echo "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans

echo "Cleaning up unused Docker resources..."
docker system prune -f

echo "Pulling latest changes..."
git pull origin main

echo "Updating submodules..."
git submodule update --init --recursive

echo "Building and starting production containers..."
docker compose -f docker-compose.prod.yml up --build -d

echo "Waiting for containers to be healthy..."
sleep 10

echo "Checking container status..."
docker compose -f docker-compose.prod.yml ps

echo "=== Production deployment completed successfully! ==="
echo "Timestamp: $(date)"

echo "Application should be available at http://$(hostname -I | awk '{print $1}'):80"
