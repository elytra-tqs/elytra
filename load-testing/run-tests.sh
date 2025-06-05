#!/bin/bash

TEST_TYPE="auth"
DURATION="2m"
VUS="10"

show_help() {

}

# Check for help first
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        auth|simple|mixed|all)
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

echo "Checking if services are up..."
if ! curl -s http://localhost:80/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{}' > /dev/null 2>&1; then
    echo "Error: Services not running. Start with: docker-compose up"
    exit 1
fi
echo "✓ Services are running"

mkdir -p results

run_single_test() {
    local test="$1"
    local script="scripts/${test}.js"
    local output="results/${test}-$(date +%Y%m%d-%H%M%S).json"
    
    case "$test" in
        "auth")
            script="scripts/auth-load-test.js"
            ;;
        "simple-station-test")
            script="scripts/simple-station-test.js"
            ;;
        "mixed-workflow-test")
            script="scripts/mixed-workflow-test.js"
            ;;
    esac
    
    if [[ ! -f "$script" ]]; then
        echo "Error: $script not found"
        return 1
    fi
    
    echo "Running $test test (${VUS} users, ${DURATION})..."
    
    if [[ "$PROMETHEUS_OUTPUT" != "true" ]]; then
        k6 run --vus $VUS --duration $DURATION --out json=$output $script
    else
        k6 run --vus $VUS --duration $DURATION \
            --out json=$output \
            --out experimental-prometheus-rw=http://localhost:9090/api/v1/write \
            --tag testid=$test \
            --tag testname=$test \
            --tag environment=dev \
            $script
    fi
}

case "$TEST_TYPE" in
    auth)
        run_single_test "auth"
        ;;
    simple)
        run_single_test "simple-station-test"
        ;;
    mixed)
        run_single_test "mixed-workflow-test"
        ;;
    all)
        echo "Running all authentication tests..."
        run_single_test "auth"
        run_single_test "simple-station-test"
        run_single_test "mixed-workflow-test"
        ;;
    *)
        echo "Invalid test type: $TEST_TYPE"
        show_help
        exit 1
        ;;
esac

echo "Done!"