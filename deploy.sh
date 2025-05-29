#!/bin/bash

set -e

echo "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

git pull

git submodule foreach git pull

echo "Starting production deployment..."

echo "Verifying submodules are present..."
if [ ! -f "stations-management/Dockerfile" ]; then
    echo "Error: stations-management Dockerfile not found"
    exit 1
fi


echo "Building and starting production containers..."
docker compose -f docker-compose.prod.yml up --build -d

echo "Production deployment completed successfully!"
