#!/bin/bash

TEST_TYPE="station"
DURATION="2m"
VUS="10"



echo "Checking if services are up..."
if ! curl -s http://localhost:80/api/v1/stations > /dev/null 2>&1; then
    echo "Error: Services not running. Start with: docker-compose up"
    exit 1
fi
echo "✓ Services are running"

while [[ $# -gt 0 ]]; do
    case $1 in
        station|charger|mixed|extreme|all)
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
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

mkdir -p results

run_single_test() {
    local test="$1"
    local script="scripts/${test}-load-test.js"
    local output="results/${test}-$(date +%Y%m%d-%H%M%S).json"
    
    if [[ ! -f "$script" ]]; then
        echo "Error: $script not found"
        return 1
    fi
    
    echo "Running $test test (${VUS} users, ${DURATION})..."
    k6 run --vus $VUS --duration $DURATION --out json=$output $script
    echo "✓ Results saved to $output"
}

case "$TEST_TYPE" in
    station)
        run_single_test "station"
        ;;
    charger)
        run_single_test "charger"
        ;;
    mixed)
        run_single_test "mixed-workflow"
        ;;
    extreme)
        run_single_test "extreme-load"
        ;;
    all)
        echo "Running all tests..."
        run_single_test "station"
        run_single_test "charger"
        run_single_test "mixed-workflow"
        run_single_test "extreme-load"
        ;;
    *)
        echo "Invalid test type: $TEST_TYPE"
        show_help
        exit 1
        ;;
esac

echo "Done!"