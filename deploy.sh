#!/bin/bash

set -e

echo "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

git pull

echo "Building and starting production containers..."
docker compose -f docker-compose.prod.yml up --build -d

echo "Production deployment completed successfully!"
