import { createHealthServer } from "./server.js";

const host = process.env["HOST"] ?? "127.0.0.1";
const port = Number(process.env["PORT"] ?? 3002);
createHealthServer().listen(port, host, () => {
  console.log(`tenant-provisioner em http://${host}:${port}`);
});
