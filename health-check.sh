#!/bin/bash

echo "=== Elytra Health Check ==="
echo "Timestamp: $(date)"

echo "Checking container status..."
docker compose -f docker-compose.prod.yml ps

echo ""
echo "Checking if containers are running..."
NGINX_STATUS=$(docker compose -f docker-compose.prod.yml ps nginx --format "table {{.State}}" | tail -n 1)
STATIONS_STATUS=$(docker compose -f docker-compose.prod.yml ps stations-management --format "table {{.State}}" | tail -n 1)

if [[ "$NGINX_STATUS" == *"running"* ]]; then
    echo "✅ Nginx container is running"
else
    echo "❌ Nginx container is not running"
fi

if [[ "$STATIONS_STATUS" == *"running"* ]]; then
    echo "✅ Stations Management container is running"
else
    echo "❌ Stations Management container is not running"
fi

echo ""
echo "Checking HTTP response..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80 || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Application is responding (HTTP $HTTP_STATUS)"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "❌ Cannot connect to application"
else
    echo "⚠️  Application responded with HTTP $HTTP_STATUS"
fi

echo ""
echo "Recent container logs (last 10 lines):"
echo "--- Nginx logs ---"
docker compose -f docker-compose.prod.yml logs --tail=10 nginx

echo ""
echo "--- Stations Management logs ---"
docker compose -f docker-compose.prod.yml logs --tail=10 stations-management

echo ""
echo "=== Health Check Complete ===" 