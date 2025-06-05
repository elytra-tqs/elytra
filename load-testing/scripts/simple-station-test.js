import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Custom metrics that will be available in Prometheus
export const errorRate = new Rate("k6_errors");
export const responseTime = new Trend("k6_response_time");
export const totalRequests = new Counter("k6_total_requests");
export const successfulRequests = new Counter("k6_successful_requests");

export const options = {
  stages: [
    { duration: "20s", target: 5 },
    { duration: "40s", target: 10 },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
    k6_errors: ["rate<0.05"],
  },
};

const BASE_URL = "http://localhost:80/api/v1";

export function setup() {
  console.log("Setting up simple test data...");

  // Create a test station
  const response = http.post(
    `${BASE_URL}/stations`,
    JSON.stringify({
      name: "Load Test Station",
      address: "123 Test Street",
      latitude: 40.7128,
      longitude: -74.006,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (response.status === 201) {
    const station = JSON.parse(response.body);
    console.log(`Created test station: ${station.id}`);
    return { stationId: station.id };
  }

  return { stationId: null };
}

export default function (data) {
  const { stationId } = data;

  // Test 1: Get all stations
  let response = http.get(`${BASE_URL}/stations`);
  totalRequests.add(1);

  let success = check(response, {
    "Get stations - status 200": (r) => r.status === 200,
    "Get stations - response time < 200ms": (r) => r.timings.duration < 200,
    "Get stations - is array": (r) => Array.isArray(JSON.parse(r.body)),
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    errorRate.add(1);
  }

  responseTime.add(response.timings.duration);

  sleep(1);

  // Test 2: Get specific station (if available)
  if (stationId) {
    response = http.get(`${BASE_URL}/stations/${stationId}`);
    totalRequests.add(1);

    success = check(response, {
      "Get station by ID - status 200": (r) => r.status === 200,
      "Get station by ID - response time < 150ms": (r) =>
        r.timings.duration < 150,
      "Get station by ID - has name": (r) => {
        const station = JSON.parse(r.body);
        return station.name && station.name.length > 0;
      },
    });

    if (success) {
      successfulRequests.add(1);
    } else {
      errorRate.add(1);
    }

    responseTime.add(response.timings.duration);
  }

  sleep(1);

  // Test 3: Create a new station
  response = http.post(
    `${BASE_URL}/stations`,
    JSON.stringify({
      name: `Test Station ${Math.random().toString(36).substring(7)}`,
      address: `${Math.floor(Math.random() * 9999)} Random Street`,
      latitude: 40.7 + (Math.random() - 0.5) * 0.1,
      longitude: -74.0 + (Math.random() - 0.5) * 0.1,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  totalRequests.add(1);

  success = check(response, {
    "Create station - status 201": (r) => r.status === 201,
    "Create station - response time < 300ms": (r) => r.timings.duration < 300,
    "Create station - returns station with ID": (r) => {
      if (r.status !== 201) return false;
      const station = JSON.parse(r.body);
      return station.id && station.id > 0;
    },
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    errorRate.add(1);
  }

  responseTime.add(response.timings.duration);

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

export function teardown(data) {
  console.log("Cleaning up test data...");

  const { stationId } = data;

  if (stationId) {
    const response = http.del(`${BASE_URL}/stations/${stationId}`);
    if (response.status === 204) {
      console.log(`Deleted test station ${stationId}`);
    }
  }
}
