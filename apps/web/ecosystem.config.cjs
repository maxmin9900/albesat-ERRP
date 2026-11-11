/** PM2 config — keeps Next.js running after SSH disconnect. */
module.exports = {
  apps: [
    {
      name: "carpet-web",
      cwd: __dirname,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: "3050",
        HOSTNAME: "0.0.0.0",
        // Same-origin API via nginx — do NOT use http://127.0.0.1 in the browser bundle.
        NEXT_PUBLIC_API_URL: "/api/v1",
        API_INTERNAL_URL: "http://127.0.0.1:8010",
      },
    },
  ],
};
