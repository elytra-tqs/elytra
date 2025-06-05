import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

export const errorRate = new Rate("workflow_errors");
export const responseTime = new Trend("workflow_response_time");
export const workflowCompletions = new Counter("completed_workflows");
export const workflowSteps = new Counter("workflow_steps");
export const authWorkflows = new Counter("auth_workflows");
export const registrationWorkflows = new Counter("registration_workflows");

export const options = {
  stages: [
    { duration: "1m", target: 30 },
    { duration: "2m", target: 60 },
    { duration: "5m", target: 80 },
    { duration: "1m", target: 40 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500"],
    http_req_failed: ["rate<0.05"],
    workflow_errors: ["rate<0.08"],
    completed_workflows: ["count>30"],
  },
};

const BASE_URL = "http://localhost:80/api/v1";

// User templates for different workflow scenarios
const userTemplates = {
  drivers: [
    { firstName: "Alice", lastName: "Johnson", licensePrefix: "ALJ" },
    { firstName: "Bob", lastName: "Smith", licensePrefix: "BBS" },
    { firstName: "Carol", lastName: "Williams", licensePrefix: "CCW" },
    { firstName: "David", lastName: "Brown", licensePrefix: "DDB" },
    { firstName: "Emma", lastName: "Davis", licensePrefix: "EED" },
  ],
  operators: [
    { firstName: "Frank", lastName: "Miller", company: "EcoCharge Solutions" },
    { firstName: "Grace", lastName: "Wilson", company: "GreenPower Networks" },
    { firstName: "Henry", lastName: "Moore", company: "ElectricHub Corp" },
    { firstName: "Iris", lastName: "Taylor", company: "VoltStation Inc" },
    { firstName: "Jack", lastName: "Anderson", company: "PowerPoint Systems" },
  ]
};

const testCredentials = [
  { username: "admin", password: "admin123" },
  { username: "testuser", password: "password" },
  { username: "demo", password: "demo123" },
];

export function setup() {
  console.log("Setting up mixed authentication workflow test...");
  return { userTemplates, testCredentials };
}

export default function (data) {
  const { userTemplates, testCredentials } = data;

  // Simulate different authentication workflows
  const workflowType = Math.random();

  if (workflowType < 0.4) {
    // 40% - New driver onboarding workflow
    newDriverWorkflow(userTemplates.drivers);
  } else if (workflowType < 0.7) {
    // 30% - New operator onboarding workflow  
    newOperatorWorkflow(userTemplates.operators);
  } else {
    // 30% - Existing user login workflow
    existingUserLoginWorkflow(testCredentials);
  }

  sleep(Math.random() * 1.5 + 0.5);
}

function newDriverWorkflow(driverTemplates) {
  console.log("Executing new driver onboarding workflow...");
  workflowSteps.add(1);
  authWorkflows.add(1);

  const template = driverTemplates[Math.floor(Math.random() * driverTemplates.length)];
  const randomId = Math.random().toString(36).substring(7);
  const timestamp = Date.now();

  // Step 1: User decides to register as EV driver
  sleep(0.2); // User fills out form

  // Step 2: Submit driver registration
  const registrationData = {
    user: {
      username: `${template.firstName.toLowerCase()}_${randomId}`,
      email: `${template.firstName.toLowerCase()}.${template.lastName.toLowerCase()}+${randomId}@example.com`,
      password: "securepassword123",
      firstName: template.firstName,
      lastName: template.lastName
    },
    driver: {
      driverLicense: `${template.licensePrefix}${timestamp}${randomId.toUpperCase()}`
    }
  };

  const response1 = http.post(
    `${BASE_URL}/auth/register/driver`,
    JSON.stringify(registrationData),
    { 
      headers: { "Content-Type": "application/json" },
      timeout: "15s"
    }
  );

  const step1Success = check(response1, {
    "Driver Workflow - Registration successful": (r) => r.status === 200,
    "Driver Workflow - Registration response time ok": (r) => r.timings.duration < 1000,
    "Driver Workflow - Returns auth data": (r) => {
      if (r.status !== 200) return false;
      try {
        const result = JSON.parse(r.body);
        return result.token && result.driverId && result.userType === "EV_DRIVER";
      } catch (e) {
        return false;
      }
    }
  });

  if (!step1Success) {
    errorRate.add(true);
    return;
  }

  registrationWorkflows.add(1);
  sleep(0.5); // User reviews confirmation

  // Step 3: Simulate immediate login attempt with new credentials
  const loginData = {
    username: registrationData.user.username,
    password: registrationData.user.password
  };

  const response2 = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(loginData),
    { 
      headers: { "Content-Type": "application/json" },
      timeout: "10s"
    }
  );

  const step2Success = check(response2, {
    "Driver Workflow - Post-registration login successful": (r) => r.status === 200,
    "Driver Workflow - Login response time ok": (r) => r.timings.duration < 800,
  });

  if (step2Success) {
    workflowCompletions.add(1);
  } else {
    errorRate.add(true);
  }

  const totalTime = response1.timings.duration + response2.timings.duration;
  responseTime.add(totalTime);
}

function newOperatorWorkflow(operatorTemplates) {
  console.log("Executing new operator onboarding workflow...");
  workflowSteps.add(1);
  authWorkflows.add(1);

  const template = operatorTemplates[Math.floor(Math.random() * operatorTemplates.length)];
  const randomId = Math.random().toString(36).substring(7);
  const timestamp = Date.now();

  // Step 1: User decides to register as station operator
  sleep(0.3); // User fills out more complex form

  // Step 2: Submit operator registration
  const registrationData = {
    user: {
      username: `${template.firstName.toLowerCase()}_op_${randomId}`,
      email: `${template.firstName.toLowerCase()}.${template.lastName.toLowerCase()}+op${randomId}@${template.company.toLowerCase().replace(/ /g, '')}.com`,
      password: "operatorpass123",
      firstName: template.firstName,
      lastName: template.lastName
    },
    operator: {
      companyName: `${template.company} ${timestamp}`,
      contactNumber: `555-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    },
    stationId: null // No station assignment in load test
  };

  const response1 = http.post(
    `${BASE_URL}/auth/register/operator`,
    JSON.stringify(registrationData),
    { 
      headers: { "Content-Type": "application/json" },
      timeout: "15s"
    }
  );

  const step1Success = check(response1, {
    "Operator Workflow - Registration successful": (r) => r.status === 200,
    "Operator Workflow - Registration response time ok": (r) => r.timings.duration < 1000,
    "Operator Workflow - Returns auth data": (r) => {
      if (r.status !== 200) return false;
      try {
        const result = JSON.parse(r.body);
        return result.token && result.operatorId && result.userType === "STATION_OPERATOR";
      } catch (e) {
        return false;
      }
    }
  });

  if (!step1Success) {
    errorRate.add(true);
    return;
  }

  registrationWorkflows.add(1);
  sleep(0.7); // Operator reviews business confirmation

  // Step 3: Simulate immediate login attempt with new credentials
  const loginData = {
    username: registrationData.user.username,
    password: registrationData.user.password
  };

  const response2 = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(loginData),
    { 
      headers: { "Content-Type": "application/json" },
      timeout: "10s"
    }
  );

  const step2Success = check(response2, {
    "Operator Workflow - Post-registration login successful": (r) => r.status === 200,
    "Operator Workflow - Login response time ok": (r) => r.timings.duration < 800,
  });

  if (step2Success) {
    workflowCompletions.add(1);
  } else {
    errorRate.add(true);
  }

  const totalTime = response1.timings.duration + response2.timings.duration;
  responseTime.add(totalTime);
}

function existingUserLoginWorkflow(testCredentials) {
  console.log("Executing existing user login workflow...");
  workflowSteps.add(1);
  authWorkflows.add(1);

  // Step 1: User navigates to login page
  sleep(0.2);

  // Step 2: Multiple login attempts (simulating users with different success rates)
  const attempts = Math.floor(Math.random() * 3) + 1; // 1-3 attempts
  let successfulLogin = false;

  for (let i = 0; i < attempts && !successfulLogin; i++) {
    const attemptScenario = Math.random();
    let loginData;

    if (attemptScenario < 0.4 && testCredentials.length > 0) {
      // 40% - Try with potentially valid credentials
      const creds = testCredentials[Math.floor(Math.random() * testCredentials.length)];
      loginData = {
        username: creds.username,
        password: creds.password
      };
    } else if (attemptScenario < 0.7) {
      // 30% - Wrong password for existing user
      const creds = testCredentials[Math.floor(Math.random() * testCredentials.length)];
      loginData = {
        username: creds.username,
        password: "wrongpassword"
      };
    } else {
      // 30% - Completely wrong credentials
      const randomId = Math.random().toString(36).substring(7);
      loginData = {
        username: `nonexistent_${randomId}`,
        password: "invalidpass"
      };
    }

    sleep(0.3); // User types credentials

    const response = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify(loginData),
      { 
        headers: { "Content-Type": "application/json" },
        timeout: "10s"
      }
    );

    const loginSuccess = check(response, {
      "Login Workflow - Response received": (r) => r.status === 200 || r.status === 400 || r.status === 401,
      "Login Workflow - Response time ok": (r) => r.timings.duration < 600,
      "Login Workflow - Proper format": (r) => {
        if (r.status === 200) {
          try {
            const result = JSON.parse(r.body);
            return result.token && result.username;
          } catch (e) {
            return false;
          }
        }
        return true; // Error responses are acceptable
      }
    });

    responseTime.add(response.timings.duration);

    if (response.status === 200) {
      successfulLogin = true;
      workflowCompletions.add(1);
      break;
    } else if (!loginSuccess) {
      errorRate.add(true);
      break;
    }

    // Brief pause between attempts
    if (i < attempts - 1) {
      sleep(0.5);
    }
  }

  if (!successfulLogin && attempts > 1) {
    // User gives up after multiple failed attempts - this is normal behavior
    console.log("User gave up after multiple failed login attempts");
  }
}

export function teardown(data) {
  console.log("Mixed authentication workflow test completed");
  console.log("Note: Created test users will remain in the database for future testing");
}
