import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const metadata = { title: "Ops Panel – Servers" };

type Server = {
  id: string;
  name: string;
  address: string;
  status: "online" | "offline" | "unknown";
};

const mockServers: Server[] = [
  { id: "srv-1", name: "Edge-01", address: "10.0.1.10", status: "online" },
  { id: "srv-2", name: "Edge-02", address: "10.0.1.11", status: "offline" },
  { id: "srv-3", name: "Transcoder", address: "10.0.2.20", status: "online" },
  { id: "srv-4", name: "Monitor", address: "10.0.3.30", status: "unknown" },
];

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

export default function DashboardHome() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {mockServers.map((srv) => (
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
    </div>
  );
}
