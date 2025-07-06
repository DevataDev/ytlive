import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";

// Temporary – reuse mock list until API integration
const mockServers = [
  { id: "srv-1", name: "Edge-01", address: "10.0.1.10", status: "online" },
  { id: "srv-2", name: "Edge-02", address: "10.0.1.11", status: "offline" },
  { id: "srv-3", name: "Transcoder", address: "10.0.2.20", status: "online" },
  { id: "srv-4", name: "Monitor", address: "10.0.3.30", status: "unknown" },
];

type Props = { params: { serverId: string } };

export const metadata = { title: "Server Details" };

export default function ServerPage({ params }: Props) {
  const server = mockServers.find((s) => s.id === params.serverId);
  if (!server) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{server.name}</h1>
        <Link href="/dashboard" className="text-sm underline">← Back</Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="font-medium">Address:</span> {server.address}</div>
          <div><span className="font-medium">Status:</span> {server.status}</div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="secondary" disabled>
          Open Shell (coming soon)
        </Button>
        <Button variant="secondary" disabled>
          Docker Actions
        </Button>
        <Button variant="secondary" disabled>
          View Metrics
        </Button>
      </div>
    </div>
  );
}
