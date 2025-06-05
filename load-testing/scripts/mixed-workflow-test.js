import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

export const errorRate = new Rate("workflow_errors");
export const responseTime = new Trend("workflow_response_time");
export const workflowCompletions = new Counter("completed_workflows");
export const workflowSteps = new Counter("workflow_steps");

export const options = {
  stages: [
    { duration: "1m", target: 80 },
    { duration: "1m", target: 120 },
    { duration: "10m", target: 120 },
    { duration: "1m", target: 60 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.02"],
    workflow_errors: ["rate<0.05"],
    completed_workflows: ["count>50"],
  },
};

const BASE_URL = "http://localhost:80/api/v1";

const stationTemplates = [
  {
    name: "Madison Square Charging",
    address: "100 Madison Avenue",
    latitude: 40.7589,
    longitude: -73.9851,
  },
  {
    name: "Brooklyn Heights Station",
    address: "500 Furman Street",
    latitude: 40.6892,
    longitude: -74.0445,
  },
  {
    name: "JFK Terminal Hub",
    address: "200 Airport Boulevard",
    latitude: 40.6413,
    longitude: -73.7781,
  },
  {
    name: "Manhattan Plaza",
    address: "300 West 42nd Street",
    latitude: 40.7505,
    longitude: -73.9934,
  },
  {
    name: "Central Park South",
    address: "400 Central Park South",
    latitude: 40.7282,
    longitude: -74.0776,
  },
];

let sharedData = {
  stationIds: [],
  chargerIds: [],
  adminSessionData: [],
};

export function setup() {
  console.log("Setting up mixed workflow test environment...");

  // Create initial infrastructure
  stationTemplates.forEach((template, index) => {
    const stationData = {
      ...template,
      name: `${template.name} ${Date.now()}`,
    };

    const response = http.post(
      `${BASE_URL}/stations`,
      JSON.stringify(stationData),
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.status === 201) {
      const station = JSON.parse(response.body);
      sharedData.stationIds.push(station.id);

      // Add chargers to each station
      const chargerCount = Math.floor(Math.random() * 4) + 2; // 2-5 chargers per station
      for (let i = 0; i < chargerCount; i++) {
        const chargerData = {
          model: `Model-${i + 1}`,
          powerOutput: [75, 100, 150, 200][Math.floor(Math.random() * 4)],
          status: "AVAILABLE",
        };

        const chargerResponse = http.post(
          `${BASE_URL}/stations/${station.id}/chargers`,
          JSON.stringify(chargerData),
          { headers: { "Content-Type": "application/json" } }
        );

        if (chargerResponse.status === 201) {
          const charger = JSON.parse(chargerResponse.body);
          sharedData.chargerIds.push(charger.id);
        }
      }
    }
  });

  console.log(
    `Setup complete: ${sharedData.stationIds.length} stations, ${sharedData.chargerIds.length} chargers`
  );
  return sharedData;
}

export default function (data) {
  const { stationIds, chargerIds } = data;

  if (stationIds.length === 0) {
    console.log("No test data available");
    return;
  }

  // Simulate different user types and workflows
  const userType = Math.random();

  if (userType < 0.6) {
    // 60% - EV Driver workflow
    evDriverWorkflow(stationIds, chargerIds);
  } else if (userType < 0.85) {
    // 25% - Station Admin workflow
    stationAdminWorkflow(stationIds, chargerIds);
  } else {
    // 15% - System monitoring workflow
    systemMonitoringWorkflow(stationIds, chargerIds);
  }

  sleep(Math.random() * 1.5 + 0.5);
}

function evDriverWorkflow(stationIds, chargerIds) {
  console.log("Executing EV Driver workflow...");
  workflowSteps.add(1);

  // Step 1: Find nearby stations
  const response1 = http.get(`${BASE_URL}/stations`);
  const step1Success = check(response1, {
    "EV Driver - Get stations successful": (r) => r.status === 200,
    "EV Driver - Stations response time ok": (r) => r.timings.duration < 500,
  });

  if (!step1Success) {
    errorRate.add(true);
    return;
  }

  const stations = JSON.parse(response1.body);
  if (stations.length === 0) return;

  sleep(0.5); // Faster user decision time

  // Step 2: Check specific station details
  const selectedStation = stations[Math.floor(Math.random() * stations.length)];
  const response2 = http.get(`${BASE_URL}/stations/${selectedStation.id}`);
  const step2Success = check(response2, {
    "EV Driver - Get station details successful": (r) => r.status === 200,
  });

  if (!step2Success) {
    errorRate.add(true);
    return;
  }

  sleep(0.3);

  // Step 3: Check available chargers at station
  const response3 = http.get(
    `${BASE_URL}/stations/${selectedStation.id}/chargers`
  );
  const step3Success = check(response3, {
    "EV Driver - Get station chargers successful": (r) => r.status === 200,
  });

  if (!step3Success) {
    errorRate.add(true);
    return;
  }

  const chargers = JSON.parse(response3.body);
  const availableChargers = chargers.filter((c) => c.status === "AVAILABLE");

  if (availableChargers.length > 0) {
    sleep(0.5); // User arrives and starts charging

    // Step 4: Simulate charger usage (status change to BEING_USED)
    const selectedCharger = availableChargers[0];
    const response4 = http.put(
      `${BASE_URL}/chargers/${selectedCharger.id}/availability`,
      JSON.stringify("BEING_USED"),
      { headers: { "Content-Type": "application/json" } }
    );

    const step4Success = check(response4, {
      "EV Driver - Start charging successful": (r) => r.status === 200,
    });

    if (step4Success) {
      sleep(1); // Faster charging simulation

      // Step 5: Finish charging
      const response5 = http.put(
        `${BASE_URL}/chargers/${selectedCharger.id}/availability`,
        JSON.stringify("AVAILABLE"),
        { headers: { "Content-Type": "application/json" } }
      );

      check(response5, {
        "EV Driver - Finish charging successful": (r) => r.status === 200,
      });

      workflowCompletions.add(1);
    }
  }

  responseTime.add(
    response1.timings.duration +
      response2.timings.duration +
      response3.timings.duration
  );
}

function stationAdminWorkflow(stationIds, chargerIds) {
  console.log("Executing Station Admin workflow...");
  workflowSteps.add(1);

  const workflow = Math.random();

  if (workflow < 0.4) {
    // Charger maintenance workflow
    if (chargerIds.length === 0) return;

    const chargerId = chargerIds[Math.floor(Math.random() * chargerIds.length)];

    // Mark charger for maintenance
    const response1 = http.put(
      `${BASE_URL}/chargers/${chargerId}/availability`,
      JSON.stringify("UNDER_MAINTENANCE"),
      { headers: { "Content-Type": "application/json" } }
    );

    const success1 = check(response1, {
      "Admin - Mark maintenance successful": (r) => r.status === 200,
    });

    if (success1) {
      sleep(1.5); // Faster maintenance simulation

      // Return to service
      const response2 = http.put(
        `${BASE_URL}/chargers/${chargerId}/availability`,
        JSON.stringify("AVAILABLE"),
        { headers: { "Content-Type": "application/json" } }
      );

      check(response2, {
        "Admin - Return to service successful": (r) => r.status === 200,
      });

      workflowCompletions.add(1);
    }
  } else if (workflow < 0.7) {
    // Add new station workflow
    const newStation = {
      name: `New Station ${Date.now()}`,
      address: `${Math.floor(Math.random() * 9999)} New Address St`,
      latitude: 40.7 + (Math.random() - 0.5) * 0.1,
      longitude: -74.0 + (Math.random() - 0.5) * 0.1,
    };

    const response = http.post(
      `${BASE_URL}/stations`,
      JSON.stringify(newStation),
      { headers: { "Content-Type": "application/json" } }
    );

    const success = check(response, {
      "Admin - Create station successful": (r) => r.status === 201,
      "Admin - Create station response time ok": (r) =>
        r.timings.duration < 1000,
    });

    if (success) {
      workflowCompletions.add(1);
    }
  } else {
    // Update station information
    if (stationIds.length === 0) return;

    const stationId = stationIds[Math.floor(Math.random() * stationIds.length)];
    const updatedStation = {
      name: `Updated Station ${Date.now()}`,
      address: `${Math.floor(Math.random() * 9999)} Updated Address Ave`,
      latitude: 40.7 + (Math.random() - 0.5) * 0.1,
      longitude: -74.0 + (Math.random() - 0.5) * 0.1,
    };

    const response = http.put(
      `${BASE_URL}/stations/${stationId}`,
      JSON.stringify(updatedStation),
      { headers: { "Content-Type": "application/json" } }
    );

    const success = check(response, {
      "Admin - Update station successful": (r) => r.status === 200,
    });

    if (success) {
      workflowCompletions.add(1);
    }
  }
}

function systemMonitoringWorkflow(stationIds, chargerIds) {
  console.log("Executing System Monitoring workflow...");
  workflowSteps.add(1);

  // Check system status by querying multiple endpoints
  const responses = [];

  // Get all stations
  responses.push(http.get(`${BASE_URL}/stations`));

  // Check chargers by status
  const statuses = ["AVAILABLE", "BEING_USED", "UNDER_MAINTENANCE"];
  statuses.forEach((status) => {
    responses.push(http.get(`${BASE_URL}/chargers/availability/${status}`));
  });

  // Random station health checks
  if (stationIds.length > 0) {
    const randomStations = stationIds
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    randomStations.forEach((stationId) => {
      responses.push(http.get(`${BASE_URL}/stations/${stationId}`));
      responses.push(http.get(`${BASE_URL}/stations/${stationId}/chargers`));
    });
  }

  const allSuccessful = responses.every((response) =>
    check(response, {
      "Monitoring - Request successful": (r) => r.status === 200,
      "Monitoring - Response time acceptable": (r) => r.timings.duration < 300,
    })
  );

  if (allSuccessful) {
    workflowCompletions.add(1);
  } else {
    errorRate.add(true);
  }

  const totalResponseTime = responses.reduce(
    (sum, r) => sum + r.timings.duration,
    0
  );
  responseTime.add(totalResponseTime);
}

export function teardown(data) {
  console.log("Cleaning up mixed workflow test data...");

  const { stationIds } = data;

  // Clean up created stations
  stationIds.forEach((stationId) => {
    const response = http.del(`${BASE_URL}/stations/${stationId}`);
    if (response.status === 204) {
      console.log(`Cleaned up station ${stationId}`);
    }
  });
}
