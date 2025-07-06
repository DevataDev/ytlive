import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const metadata = { title: "Ops Panel – Servers" };

type Server = {
  id: string;
  name: string;
  address: string;
  status: "online" | "offline" | "unknown";
};

// Fetch server list from backend API
async function fetchServers(): Promise<Server[]> {
  const base = process.env.NEXT_PUBLIC_OPS_API_URL ?? "http://localhost:8080";
  const url = `${base}/servers`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`API responded with ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.error("fetchServers() error:", err);
    // Rethrow so caller can decide how to render
    throw err;
  }
}


// Fallback: adjust typing later

function statusColor(status: Server["status"]): string {
  switch (status) {
    case "online":
      return "text-green-600";
    case "offline":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

export default async function DashboardHome() {
  let servers: Server[] = [];
  let errMsg: string | null = null;
  try {
    servers = await fetchServers();
  } catch {
    errMsg = "Unable to load servers right now. Please try again later.";
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {servers.map((srv) => (
        <Card key={srv.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{srv.name}</span>
              <span className={statusColor(srv.status)}>
                ● {srv.status.charAt(0).toUpperCase() + srv.status.slice(1)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{srv.address}</p>
            <Link href={`/dashboard/${srv.id}`} className="text-primary underline text-sm">
              Details
            </Link>
          </CardContent>
        </Card>
      ))}
      {errMsg && (
        <p className="col-span-full mt-2 text-sm text-red-600" role="alert">
          {errMsg}
        </p>
      )}
    </div>
  );
}
