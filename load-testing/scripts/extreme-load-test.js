import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

export const errorRate = new Rate("brooklyn_errors");
export const responseTime = new Trend("brooklyn_response_time");
export const requestCount = new Counter("brooklyn_requests");
export const concurrentOperations = new Counter("concurrent_operations");

export const options = {
  stages: [
    { duration: "1m", target: 200 },
    { duration: "1m", target: 300 },
    { duration: "10m", target: 300 },
    { duration: "1m", target: 150 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.15"],
    brooklyn_errors: ["rate<0.15"],
    brooklyn_requests: ["count>3000"],
  },
};

const BASE_URL = "http://localhost:80/api/v1";

const operationWeights = {
  manhattanRead: 0.4,
  queensWrite: 0.3,
  bronxBurst: 0.2,
  statenIslandStress: 0.1,
};

let globalData = {
  stationIds: [],
  chargerIds: [],
  createdResources: [],
};

export function setup() {
  console.log("Setting up brooklyn load test environment...");

  const baseStations = 10;

  for (let i = 0; i < baseStations; i++) {
    const stationData = {
      name: `Brooklyn Station ${i + 1} ${Date.now()}`,
      address: `${1000 + i} Atlantic Ave`,
      latitude: 40.7 + (Math.random() - 0.5) * 0.2,
      longitude: -74.0 + (Math.random() - 0.5) * 0.2,
    };

    const response = http.post(
      `${BASE_URL}/stations`,
      JSON.stringify(stationData),
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.status === 201) {
      const station = JSON.parse(response.body);
      globalData.stationIds.push(station.id);

      const chargerCount = Math.floor(Math.random() * 6) + 5;
      for (let j = 0; j < chargerCount; j++) {
        const chargerData = {
          model: `Brooklyn-${i}-${j}`,
          powerOutput: [75, 100, 150, 200, 350][Math.floor(Math.random() * 5)],
          status: "AVAILABLE",
        };

        const chargerResponse = http.post(
          `${BASE_URL}/stations/${station.id}/chargers`,
          JSON.stringify(chargerData),
          { headers: { "Content-Type": "application/json" } }
        );

        if (chargerResponse.status === 201) {
          const charger = JSON.parse(chargerResponse.body);
          globalData.chargerIds.push(charger.id);
        }
      }
    }
  }

  console.log(
    `Brooklyn load setup: ${globalData.stationIds.length} stations, ${globalData.chargerIds.length} chargers`
  );
  return globalData;
}

export default function (data) {
  const { stationIds, chargerIds } = data;

  if (stationIds.length === 0) {
    console.error("No test infrastructure available");
    return;
  }

  requestCount.add(1);

  const rand = Math.random();

  if (rand < operationWeights.manhattanRead) {
    manhattanReadOperations(stationIds, chargerIds);
  } else if (
    rand <
    operationWeights.manhattanRead + operationWeights.queensWrite
  ) {
    queensWriteOperations(stationIds, chargerIds);
  } else if (
    rand <
    operationWeights.manhattanRead +
      operationWeights.queensWrite +
      operationWeights.bronxBurst
  ) {
    bronxBurstOperations(stationIds, chargerIds);
  } else {
    statenIslandStressOperations(stationIds, chargerIds);
  }

  sleep(Math.random() * 0.5 + 0.1);
}

function manhattanReadOperations(stationIds, chargerIds) {
  concurrentOperations.add(1);
  const operations = [
    () => http.get(`${BASE_URL}/stations`),
    () =>
      http.get(
        `${BASE_URL}/stations/${
          stationIds[Math.floor(Math.random() * stationIds.length)]
        }`
      ),
    () => http.get(`${BASE_URL}/chargers/availability/AVAILABLE`),
    () => http.get(`${BASE_URL}/chargers/availability/BEING_USED`),
    () => http.get(`${BASE_URL}/chargers/availability/UNDER_MAINTENANCE`),
  ];

  for (let i = 0; i < 3; i++) {
    const operation = operations[Math.floor(Math.random() * operations.length)];
    const response = operation();

    check(response, {
      "Manhattan read - Success": (r) => r.status === 200,
      "Manhattan read - Fast response": (r) => r.timings.duration < 1000,
    });

    responseTime.add(response.timings.duration);
    requestCount.add(1);
  }
}

function queensWriteOperations(stationIds, chargerIds) {
  concurrentOperations.add(1);

  const writeOps = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < writeOps; i++) {
    const opType = Math.random();

    if (opType < 0.4) {
      const stationData = {
        name: `Queens Station ${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}`,
        address: `${Math.floor(Math.random() * 9999)} Northern Blvd`,
        latitude: 40.7 + (Math.random() - 0.5) * 0.1,
        longitude: -74.0 + (Math.random() - 0.5) * 0.1,
      };

      const response = http.post(
        `${BASE_URL}/stations`,
        JSON.stringify(stationData),
        { headers: { "Content-Type": "application/json" } }
      );

      check(response, {
        "Queens write - Create station success": (r) => r.status === 201,
      });

      if (response.status === 201) {
        const station = JSON.parse(response.body);
        globalData.createdResources.push({ type: "station", id: station.id });
      }
    } else if (opType < 0.7 && stationIds.length > 0) {
      const stationId =
        stationIds[Math.floor(Math.random() * stationIds.length)];
      const chargerData = {
        model: `Queens-${Date.now()}`,
        powerOutput: Math.floor(Math.random() * 300) + 50,
        status: "AVAILABLE",
      };

      const response = http.post(
        `${BASE_URL}/stations/${stationId}/chargers`,
        JSON.stringify(chargerData),
        { headers: { "Content-Type": "application/json" } }
      );

      check(response, {
        "Queens write - Create charger success": (r) => r.status === 201,
      });
    } else if (chargerIds.length > 0) {
      const chargerId =
        chargerIds[Math.floor(Math.random() * chargerIds.length)];
      const statuses = ["AVAILABLE", "BEING_USED", "UNDER_MAINTENANCE"];
      const newStatus = statuses[Math.floor(Math.random() * statuses.length)];

      const response = http.put(
        `${BASE_URL}/chargers/${chargerId}/availability`,
        JSON.stringify(newStatus),
        { headers: { "Content-Type": "application/json" } }
      );

      check(response, {
        "Queens write - Update status success": (r) => r.status === 200,
      });
    }

    requestCount.add(1);
  }
}

function bronxBurstOperations(stationIds, chargerIds) {
  concurrentOperations.add(1);

  const burstSize = Math.floor(Math.random() * 5) + 3;

  for (let i = 0; i < burstSize; i++) {
    const opType = Math.random();
    let response;

    if (opType < 0.6) {
      response = http.get(`${BASE_URL}/stations`);
    } else if (opType < 0.8 && chargerIds.length > 0) {
      const chargerId =
        chargerIds[Math.floor(Math.random() * chargerIds.length)];
      response = http.get(`${BASE_URL}/chargers/${chargerId}/availability`);
    } else if (stationIds.length > 0) {
      const stationId =
        stationIds[Math.floor(Math.random() * stationIds.length)];
      response = http.get(`${BASE_URL}/stations/${stationId}/chargers`);
    }

    if (response) {
      check(response, {
        "Bronx burst - Operation success": (r) => r.status === 200,
      });
      responseTime.add(response.timings.duration);
      requestCount.add(1);
    }

    sleep(0.05);
  }
}

function statenIslandStressOperations(stationIds, chargerIds) {
  concurrentOperations.add(1);

  const stressOperations = Math.floor(Math.random() * 8) + 5;

  for (let i = 0; i < stressOperations; i++) {
    const endpoints = [
      `${BASE_URL}/stations`,
      `${BASE_URL}/chargers/availability/AVAILABLE`,
      `${BASE_URL}/chargers/availability/BEING_USED`,
    ];

    if (stationIds.length > 0) {
      const randomStationId =
        stationIds[Math.floor(Math.random() * stationIds.length)];
      endpoints.push(`${BASE_URL}/stations/${randomStationId}`);
      endpoints.push(`${BASE_URL}/stations/${randomStationId}/chargers`);
    }

    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const response = http.get(endpoint);

    check(response, {
      "Staten Island stress - Endpoint responsive": (r) =>
        r.status === 200 || r.status === 404,
    });

    requestCount.add(1);
  }
}

export function teardown(data) {
  console.log("Cleaning up brooklyn load test resources...");

  const { stationIds } = data;
  stationIds.forEach((stationId) => {
    const response = http.del(`${BASE_URL}/stations/${stationId}`);
    if (response.status === 204) {
      console.log(`Cleaned up station ${stationId}`);
    }
  });

  globalData.createdResources.forEach((resource) => {
    if (resource.type === "station") {
      const response = http.del(`${BASE_URL}/stations/${resource.id}`);
      if (response.status === 204) {
        console.log(`Cleaned up dynamic station ${resource.id}`);
      }
    }
  });
}
