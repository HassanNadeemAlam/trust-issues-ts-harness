import { createServer } from "node:http";
import { handle } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);

createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c: Buffer) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = Symbol("invalid-json");
    }
    void handle({ method: req.method ?? "GET", path: (req.url ?? "/").split("?")[0] ?? "/", body }).then((r) => {
      res.writeHead(r.status, r.headers);
      res.end(r.body === undefined ? undefined : JSON.stringify(r.body));
    });
  });
}).listen(port);
