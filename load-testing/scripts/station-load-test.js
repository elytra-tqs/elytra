import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export const errorRate = new Rate("errors");
export const responseTime = new Trend("response_time");

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "2m", target: 150 },
    { duration: "10m", target: 150 },
    { duration: "2m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.08"],
    errors: ["rate<0.08"],
  },
};

const BASE_URL = "http://localhost:80/api/v1";

const stationData = [
  {
    name: "Downtown Emma Station",
    address: "123 Commerce Street",
    latitude: 40.7128,
    longitude: -74.006,
  },
  {
    name: "Riverside Oliver Hub",
    address: "456 River Avenue",
    latitude: 41.8781,
    longitude: -87.6298,
  },
  {
    name: "Sophia Plaza Charging",
    address: "789 Central Plaza",
    latitude: 34.0522,
    longitude: -118.2437,
  },
  {
    name: "Liam Park Station",
    address: "321 Green Park Road",
    latitude: 39.7392,
    longitude: -104.9903,
  },
];

const chargerData = [
  { model: "Tesla Supercharger V3", status: "AVAILABLE", powerOutput: 250 },
  { model: "ChargePoint Express 250", status: "AVAILABLE", powerOutput: 62.5 },
  { model: "EVgo Fast Charger", status: "AVAILABLE", powerOutput: 100 },
];

let createdStationIds = [];

export function setup() {
  console.log("Setting up test data...");

  const setupStationIds = [];
  for (let i = 0; i < 3; i++) {
    const response = http.post(
      `${BASE_URL}/stations`,
      JSON.stringify(stationData[i]),
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.status === 201) {
      const station = JSON.parse(response.body);
      setupStationIds.push(station.id);
      console.log(`Created setup station ${station.id}: ${station.name}`);
    }
  }

  return { setupStationIds };
}

export default function (data) {
  const { setupStationIds } = data;

  const scenarios = [
    () => testGetAllStations(),
    () => testGetStationById(setupStationIds),
    () => testCreateStation(),
    () => testGetStationChargers(setupStationIds),
    () => testCreateChargerForStation(setupStationIds),
  ];

  const scenario = scenarios[__ITER % scenarios.length];
  scenario();

  sleep(Math.random() * 1 + 0.5);
}

function testGetAllStations() {
  const response = http.get(`${BASE_URL}/stations`);

  const success = check(response, {
    "Get all stations - status is 200": (r) => r.status === 200,
    "Get all stations - response time < 200ms": (r) => r.timings.duration < 200,
    "Get all stations - response is array": (r) =>
      Array.isArray(JSON.parse(r.body)),
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testGetStationById(stationIds) {
  if (stationIds.length === 0) return;

  const randomStationId =
    stationIds[Math.floor(Math.random() * stationIds.length)];
  const response = http.get(`${BASE_URL}/stations/${randomStationId}`);

  const success = check(response, {
    "Get station by ID - status is 200": (r) => r.status === 200,
    "Get station by ID - response time < 150ms": (r) =>
      r.timings.duration < 150,
    "Get station by ID - has required fields": (r) => {
      const station = JSON.parse(r.body);
      return station.id && station.name && station.address;
    },
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testCreateStation() {
  const randomStation =
    stationData[Math.floor(Math.random() * stationData.length)];
  const testStation = {
    ...randomStation,
    name: `${randomStation.name} ${Math.random().toString(36).substring(7)}`,
  };

  const response = http.post(
    `${BASE_URL}/stations`,
    JSON.stringify(testStation),
    { headers: { "Content-Type": "application/json" } }
  );

  const success = check(response, {
    "Create station - status is 201": (r) => r.status === 201,
    "Create station - response time < 300ms": (r) => r.timings.duration < 300,
    "Create station - returns created station": (r) => {
      const station = JSON.parse(r.body);
      return station.id && station.name === testStation.name;
    },
  });

  if (success && response.status === 201) {
    const station = JSON.parse(response.body);
    createdStationIds.push(station.id);
  }

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testGetStationChargers(stationIds) {
  if (stationIds.length === 0) return;

  const randomStationId =
    stationIds[Math.floor(Math.random() * stationIds.length)];
  const response = http.get(`${BASE_URL}/stations/${randomStationId}/chargers`);

  const success = check(response, {
    "Get station chargers - status is 200": (r) => r.status === 200,
    "Get station chargers - response time < 200ms": (r) =>
      r.timings.duration < 200,
    "Get station chargers - response is array": (r) =>
      Array.isArray(JSON.parse(r.body)),
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testCreateChargerForStation(stationIds) {
  if (stationIds.length === 0) return;

  const randomStationId =
    stationIds[Math.floor(Math.random() * stationIds.length)];
  const randomCharger =
    chargerData[Math.floor(Math.random() * chargerData.length)];

  const response = http.post(
    `${BASE_URL}/stations/${randomStationId}/chargers`,
    JSON.stringify(randomCharger),
    { headers: { "Content-Type": "application/json" } }
  );

  const success = check(response, {
    "Create charger - status is 201": (r) => r.status === 201,
    "Create charger - response time < 300ms": (r) => r.timings.duration < 300,
    "Create charger - returns created charger": (r) => {
      if (r.status !== 201) return false;
      const charger = JSON.parse(r.body);
      return charger.id && charger.model === randomCharger.model;
    },
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

export function teardown(data) {
  console.log("Cleaning up test data...");

  const allStationIds = [...(data.setupStationIds || []), ...createdStationIds];

  allStationIds.forEach((stationId) => {
    const response = http.del(`${BASE_URL}/stations/${stationId}`);
    if (response.status === 204) {
      console.log(`Deleted station ${stationId}`);
    }
  });
}
