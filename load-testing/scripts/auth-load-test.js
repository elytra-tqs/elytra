import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

export const errorRate = new Rate("auth_errors");
export const responseTime = new Trend("auth_response_time");
export const totalRequests = new Counter("auth_total_requests");
export const successfulLogins = new Counter("successful_logins");
export const successfulRegistrations = new Counter("successful_registrations");

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "5m", target: 80 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.10"],
    auth_errors: ["rate<0.10"],
  },
};

const BASE_URL = "http://localhost:80/api/v1";

const existingUsers = [
  { username: "admin", password: "admin123" },
  { username: "operator1", password: "password123" },
  { username: "driver1", password: "password123" },
];

export function setup() {
  console.log("Setting up authentication load test...");
  return { existingUsers };
}

export default function (data) {
  const { existingUsers } = data;

  const scenario = Math.random();

  if (scenario < 0.4) {
    testDriverRegistration();
  } else if (scenario < 0.7) {
    testOperatorRegistration();
  } else {
    testLogin(existingUsers);
  }

  sleep(Math.random() * 1.5 + 0.5);
}

function testDriverRegistration() {
  const randomId = Math.random().toString(36).substring(7);
  const timestamp = Date.now();

  const registrationData = {
    user: {
      username: `driver_${randomId}_${timestamp}`,
      email: `driver_${randomId}@loadtest.com`,
      password: "loadtest123",
      firstName: "Load",
      lastName: "Test",
    },
    driver: {
      driverLicense: `DL${randomId.toUpperCase()}${timestamp}`,
    },
  };

  const response = http.post(
    `${BASE_URL}/auth/register/driver`,
    JSON.stringify(registrationData),
    {
      headers: { "Content-Type": "application/json" },
      timeout: "10s",
    }
  );

  totalRequests.add(1);

  const success = check(response, {
    "Driver registration - status is 200": (r) => r.status === 200,
    "Driver registration - response time < 800ms": (r) =>
      r.timings.duration < 800,
    "Driver registration - returns authentication data": (r) => {
      if (r.status !== 200) return false;
      try {
        const result = JSON.parse(r.body);
        return (
          result.token &&
          result.username &&
          result.driverId &&
          result.userType === "EV_DRIVER"
        );
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    successfulRegistrations.add(1);
  } else {
    errorRate.add(1);
  }

  responseTime.add(response.timings.duration);
}

function testOperatorRegistration() {
  const randomId = Math.random().toString(36).substring(7);
  const timestamp = Date.now();

  const registrationData = {
    user: {
      username: `operator_${randomId}_${timestamp}`,
      email: `operator_${randomId}@loadtest.com`,
      password: "loadtest123",
      firstName: "Operator",
      lastName: "Test",
    },
    operator: {
      companyName: `TestCompany_${randomId}`,
      contactNumber: `555-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")}`,
    },
    stationId: null,
  };

  const response = http.post(
    `${BASE_URL}/auth/register/operator`,
    JSON.stringify(registrationData),
    {
      headers: { "Content-Type": "application/json" },
      timeout: "10s",
    }
  );

  totalRequests.add(1);

  const success = check(response, {
    "Operator registration - status is 200": (r) => r.status === 200,
    "Operator registration - response time < 800ms": (r) =>
      r.timings.duration < 800,
    "Operator registration - returns authentication data": (r) => {
      if (r.status !== 200) return false;
      try {
        const result = JSON.parse(r.body);
        return (
          result.token &&
          result.username &&
          result.operatorId &&
          result.userType === "STATION_OPERATOR"
        );
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    successfulRegistrations.add(1);
  } else {
    errorRate.add(1);
  }

  responseTime.add(response.timings.duration);
}

function testLogin(existingUsers) {
  const loginScenario = Math.random();

  let loginData;
  let expectedSuccess = false;

  if (loginScenario < 0.3 && existingUsers.length > 0) {
    const user =
      existingUsers[Math.floor(Math.random() * existingUsers.length)];
    loginData = {
      username: user.username,
      password: user.password,
    };
    expectedSuccess = true;
  } else {
    const randomId = Math.random().toString(36).substring(7);
    loginData = {
      username: `nonexistent_${randomId}`,
      password: "wrongpassword",
    };
    expectedSuccess = false;
  }

  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(loginData),
    {
      headers: { "Content-Type": "application/json" },
      timeout: "10s",
    }
  );

  totalRequests.add(1);

  const success = check(response, {
    "Login - response received": (r) =>
      r.status === 200 || r.status === 400 || r.status === 401,
    "Login - response time < 600ms": (r) => r.timings.duration < 600,
    "Login - proper response format": (r) => {
      if (r.status === 200) {
        try {
          const result = JSON.parse(r.body);
          return result.token && result.username && result.userType;
        } catch (e) {
          return false;
        }
      } else if (r.status === 400 || r.status === 401) {
        return true;
      }
      return false;
    },
  });

  if (response.status === 200) {
    successfulLogins.add(1);
  }

  if (success) {
  } else {
    errorRate.add(1);
  }

  responseTime.add(response.timings.duration);
}

export function teardown(data) {
  console.log("Authentication load test completed");
  console.log("Note: Created test users will remain in the database");
}
