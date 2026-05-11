const express = require("express");

async function startTestServer(router, options = {}) {
  const app = express();

  app.use(
    express.json({
      verify: options.withRawBody
        ? (req, res, buf) => {
            req.rawBody = buf.toString("utf8");
          }
        : undefined,
    }),
  );
  app.use("/", router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const port = server.address().port;

  return {
    async request(path, options = {}) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...(options.headers || {}),
        },
      });

      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      return { status: response.status, body };
    },
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

module.exports = { startTestServer };
