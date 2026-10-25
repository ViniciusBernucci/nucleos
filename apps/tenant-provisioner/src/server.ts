import { createServer, type Server } from "node:http";
import { HEALTH_PATH, healthResponse } from "@nucleos/contracts";

export function createHealthServer(service = "tenant-provisioner"): Server {
  return createServer((req, res) => {
    if (req.method === "GET" && req.url === HEALTH_PATH) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(healthResponse(service)));
      return;
    }
    res.writeHead(404).end();
  });
}
