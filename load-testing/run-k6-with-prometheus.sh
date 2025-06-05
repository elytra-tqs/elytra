#!/bin/bash

TEST_TYPE="auth"
DURATION="2m"
VUS="10"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        auth|simple|mixed)
            TEST_TYPE="$1"
            shift
            ;;
        -d)
            DURATION="$2"
            shift 2
            ;;
        -v)
            VUS="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

case "$TEST_TYPE" in
    "auth")
        SCRIPT_FILE="auth-load-test.js"
        ;;
    "simple")
        SCRIPT_FILE="simple-station-test.js"
        ;;
    "mixed")
        SCRIPT_FILE="mixed-workflow-test.js"
        ;;
esac


if ! docker ps | grep -q "prometheus"; then
    echo "Error: Prometheus container not running. Start with:"
    echo "  docker-compose up prometheus grafana"
    exit 1
fi

echo "Starting k6 container..."
docker-compose --profile load-testing up -d k6

sleep 2

echo "Running k6 test..."
docker-compose exec k6 k6 run \
    --vus $VUS \
    --duration $DURATION \
    --out experimental-prometheus-rw \
    --tag testid=$TEST_TYPE \
    --tag testname=$TEST_TYPE \
    --tag environment=dev \
    /scripts/$SCRIPT_FILE

read -p "Stop k6 container? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose stop k6
    echo "k6 container stopped"
fi