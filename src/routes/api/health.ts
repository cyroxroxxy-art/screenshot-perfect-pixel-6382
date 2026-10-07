import { createFileRoute } from "@tanstack/react-router";
import { getAdmin, json } from "@/lib/server/http.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const ai = Boolean(process.env["LOVABLE_API_KEY"]);
        let database = false;
        try {
          const db = await getAdmin();
          const { error } = await db.from("documents").select("id", { head: true, count: "exact" }).limit(1);
          database = !error;
        } catch {
          database = false;
        }
        return json({ status: ai && database ? "ok" : "degraded", ai, database, time: new Date().toISOString() });
      },
    },
  },
});
