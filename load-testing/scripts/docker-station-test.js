import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export const errorRate = new Rate("errors");
export const responseTime = new Trend("response_time");

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "30s", target: 5 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.08"],
    errors: ["rate<0.08"],
  },
};

const BASE_URL = "http://elytra-nginx-1/api/v1";

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
];

export function setup() {
  console.log("Setting up test data...");
  
  const setupStationIds = [];
  for (let i = 0; i < 2; i++) {
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
  
  const response = http.get(`${BASE_URL}/stations`);
  
  const success = check(response, {
    "Get all stations - status is 200": (r) => r.status === 200,
    "Get all stations - response time < 200ms": (r) => r.timings.duration < 200,
    "Get all stations - response is array": (r) =>
      Array.isArray(JSON.parse(r.body)),
  });
  
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  
  sleep(1);
}

export function teardown(data) {
  console.log("Cleaning up test data...");
  
  const { setupStationIds } = data;
  
  setupStationIds.forEach((stationId) => {
    const response = http.del(`${BASE_URL}/stations/${stationId}`);
    if (response.status === 204) {
      console.log(`Deleted station ${stationId}`);
    }
  });
}