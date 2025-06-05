import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export const errorRate = new Rate("charger_errors");
export const responseTime = new Trend("charger_response_time");

export const options = {
  stages: [
    { duration: "1m", target: 60 },
    { duration: "1m", target: 120 },
    { duration: "10m", target: 120 },
    { duration: "1m", target: 60 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<600"],
    http_req_failed: ["rate<0.06"],
    charger_errors: ["rate<0.06"],
  },
};

const BASE_URL = "http://localhost:80/api/v1";

const statusTransitions = {
  AVAILABLE: ["BEING_USED", "UNDER_MAINTENANCE"],
  BEING_USED: ["AVAILABLE"],
  UNDER_MAINTENANCE: ["AVAILABLE"],
};

let setupData = {
  stationIds: [],
  chargerIds: [],
};

export function setup() {
  console.log("Setting up charger load test data...");

  // Create a test station first
  const stationResponse = http.post(
    `${BASE_URL}/stations`,
    JSON.stringify({
      name: "Charlotte Main Station",
      address: "1247 Innovation Drive",
      latitude: 40.7128,
      longitude: -74.006,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (stationResponse.status !== 201) {
    console.error("Failed to create test station");
    return setupData;
  }

  const station = JSON.parse(stationResponse.body);
  setupData.stationIds.push(station.id);

  const chargerTypes = [
    { model: "Tesla Supercharger V4", powerOutput: 250, status: "AVAILABLE" },
    { model: "Electrify America 350kW", powerOutput: 350, status: "AVAILABLE" },
    {
      model: "ChargePoint Express 250",
      powerOutput: 62.5,
      status: "AVAILABLE",
    },
    { model: "EVgo Fast 100kW", powerOutput: 100, status: "AVAILABLE" },
    { model: "Blink DC Fast 50kW", powerOutput: 50, status: "AVAILABLE" },
  ];

  chargerTypes.forEach((chargerData, index) => {
    const chargerResponse = http.post(
      `${BASE_URL}/stations/${station.id}/chargers`,
      JSON.stringify(chargerData),
      { headers: { "Content-Type": "application/json" } }
    );

    if (chargerResponse.status === 201) {
      const charger = JSON.parse(chargerResponse.body);
      setupData.chargerIds.push(charger.id);
      console.log(`Created charger ${charger.id}: ${charger.model}`);
    }
  });

  return setupData;
}

export default function (data) {
  const { stationIds, chargerIds } = data;

  if (chargerIds.length === 0) {
    console.log("No chargers available for testing");
    return;
  }

  const rand = Math.random();

  if (rand < 0.3) {
    testGetChargerAvailability(chargerIds);
  } else if (rand < 0.5) {
    testUpdateChargerStatus(chargerIds);
  } else if (rand < 0.7) {
    testGetChargersByStatus();
  } else if (rand < 0.85) {
    testUpdateChargerDetails(chargerIds);
  } else {
    testConcurrentStatusUpdates(chargerIds);
  }

  sleep(Math.random() * 0.8 + 0.3);
}

function testGetChargerAvailability(chargerIds) {
  const randomChargerId =
    chargerIds[Math.floor(Math.random() * chargerIds.length)];
  const response = http.get(
    `${BASE_URL}/chargers/${randomChargerId}/availability`
  );

  const success = check(response, {
    "Get charger availability - status is 200": (r) => r.status === 200,
    "Get charger availability - response time < 100ms": (r) =>
      r.timings.duration < 100,
    "Get charger availability - valid status": (r) => {
      const status = r.body.replace(/"/g, "");
      return ["AVAILABLE", "BEING_USED", "UNDER_MAINTENANCE"].includes(status);
    },
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testUpdateChargerStatus(chargerIds) {
  const randomChargerId =
    chargerIds[Math.floor(Math.random() * chargerIds.length)];

  const currentStatusResponse = http.get(
    `${BASE_URL}/chargers/${randomChargerId}/availability`
  );
  if (currentStatusResponse.status !== 200) {
    errorRate.add(true);
    return;
  }

  const currentStatus = currentStatusResponse.body.replace(/"/g, "");
  const possibleTransitions = statusTransitions[currentStatus] || [];

  if (possibleTransitions.length === 0) {
    return;
  }

  const newStatus =
    possibleTransitions[Math.floor(Math.random() * possibleTransitions.length)];

  const response = http.put(
    `${BASE_URL}/chargers/${randomChargerId}/availability`,
    JSON.stringify(newStatus),
    { headers: { "Content-Type": "application/json" } }
  );

  const success = check(response, {
    "Update charger status - status is 200": (r) => r.status === 200,
    "Update charger status - response time < 250ms": (r) =>
      r.timings.duration < 250,
    "Update charger status - status updated": (r) => {
      if (r.status !== 200) return false;
      const charger = JSON.parse(r.body);
      return charger.status === newStatus;
    },
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testGetChargersByStatus() {
  const statuses = ["AVAILABLE", "BEING_USED", "UNDER_MAINTENANCE"];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

  const response = http.get(
    `${BASE_URL}/chargers/availability/${randomStatus}`
  );

  const success = check(response, {
    "Get chargers by status - status is 200": (r) => r.status === 200,
    "Get chargers by status - response time < 200ms": (r) =>
      r.timings.duration < 200,
    "Get chargers by status - response is array": (r) =>
      Array.isArray(JSON.parse(r.body)),
    "Get chargers by status - all have correct status": (r) => {
      const chargers = JSON.parse(r.body);
      return chargers.every((charger) => charger.status === randomStatus);
    },
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testUpdateChargerDetails(chargerIds) {
  const randomChargerId =
    chargerIds[Math.floor(Math.random() * chargerIds.length)];

  const updatedCharger = {
    model: `Updated ${Math.random().toString(36).substring(7)}`,
    powerOutput: Math.floor(Math.random() * 300) + 50,
    status: "AVAILABLE",
  };

  const response = http.put(
    `${BASE_URL}/chargers/${randomChargerId}`,
    JSON.stringify(updatedCharger),
    { headers: { "Content-Type": "application/json" } }
  );

  const success = check(response, {
    "Update charger details - status is 200": (r) => r.status === 200,
    "Update charger details - response time < 300ms": (r) =>
      r.timings.duration < 300,
    "Update charger details - details updated": (r) => {
      if (r.status !== 200) return false;
      const charger = JSON.parse(r.body);
      return (
        charger.model === updatedCharger.model &&
        charger.powerOutput === updatedCharger.powerOutput
      );
    },
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testConcurrentStatusUpdates(chargerIds) {
  const randomChargerId =
    chargerIds[Math.floor(Math.random() * chargerIds.length)];

  for (let i = 0; i < 3; i++) {
    const response = http.get(
      `${BASE_URL}/chargers/${randomChargerId}/availability`
    );
    check(response, {
      "Concurrent status check - success": (r) => r.status === 200,
    });
  }
}

export function teardown(data) {
  console.log("Cleaning up charger load test data...");

  const { stationIds } = data;

  stationIds.forEach((stationId) => {
    const response = http.del(`${BASE_URL}/stations/${stationId}`);
    if (response.status === 204) {
      console.log(`Deleted test station ${stationId}`);
    }
  });
}
