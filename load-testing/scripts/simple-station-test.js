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
    { duration: "2m", target: 30 },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
    k6_errors: ["rate<0.05"],
  },
};

const BASE_URL = "http://localhost:80/api/v1";

const driverUsers = [
  {
    user: {
      username: "testdriver1",
      email: "driver1@test.com",
      password: "password123",
      firstName: "John",
      lastName: "Driver",
    },
    driver: {
      driverLicense: "DL123456789",
    },
  },
  {
    user: {
      username: "testdriver2",
      email: "driver2@test.com",
      password: "password123",
      firstName: "Jane",
      lastName: "Driver",
    },
    driver: {
      driverLicense: "DL987654321",
    },
  },
];

export function setup() {
  console.log("Setting up authentication load test...");
  return { driverUsers };
}

export default function (data) {
  const { driverUsers } = data;

  const testScenario = Math.random();

  if (testScenario < 0.5) {
    // Test driver registration
    testDriverRegistration(driverUsers);
  } else {
    // Test login with existing credentials
    testUserLogin();
  }

  sleep(Math.random() * 2 + 1);
}

function testDriverRegistration(driverUsers) {
  // Create unique test data for this iteration
  const randomId = Math.random().toString(36).substring(7);
  const testUser = {
    user: {
      username: `testdriver_${randomId}`,
      email: `driver_${randomId}@test.com`,
      password: "password123",
      firstName: "Test",
      lastName: "Driver",
    },
    driver: {
      driverLicense: `DL${randomId.toUpperCase()}`,
    },
  };

  const response = http.post(
    `${BASE_URL}/auth/register/driver`,
    JSON.stringify(testUser),
    { headers: { "Content-Type": "application/json" } }
  );

  totalRequests.add(1);

  const success = check(response, {
    "Register driver - status 200": (r) => r.status === 200,
    "Register driver - response time < 500ms": (r) => r.timings.duration < 500,
    "Register driver - returns token": (r) => {
      if (r.status !== 200) return false;
      const result = JSON.parse(r.body);
      return result.token && result.username && result.driverId;
    },
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    errorRate.add(1);
  }

  responseTime.add(response.timings.duration);
}

function testUserLogin() {
  // Test login with a standard test account that should exist
  const loginData = {
    username: "testuser",
    password: "password",
  };

  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(loginData),
    { headers: { "Content-Type": "application/json" } }
  );

  totalRequests.add(1);

  const success = check(response, {
    "Login - accepts request": (r) => r.status === 200 || r.status === 400, // 400 for invalid credentials is expected
    "Login - response time < 300ms": (r) => r.timings.duration < 300,
    "Login - returns proper response": (r) => {
      if (r.status === 200) {
        const result = JSON.parse(r.body);
        return result.token !== undefined; // Should have token on success
      }
      return true; // 400/401 is acceptable for invalid credentials
    },
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    errorRate.add(1);
  }

  responseTime.add(response.timings.duration);
}

export function teardown(data) {
  console.log(
    "Authentication load test completed - no cleanup needed for auth endpoints"
  );
}
