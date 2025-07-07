'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AddServerModal from "@/components/AddServerModal";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Server = {
  id: string;
  name: string;
  address: string;
  status: "online" | "offline" | "unknown";
};

async function fetchServers(): Promise<Server[]> {
  const res = await apiFetch('/servers');
  if (!res.ok) throw new Error(`API responded with ${res.status}`);
  return res.json();
}

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

export default function DashboardHomeClient() {
  const [servers, setServers] = useState<Server[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchServers()
      .then(setServers)
      .catch(() => setErrMsg("Unable to load servers right now. Please try again later."));
  }, []);

  return (
    <>
<div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setModalOpen(true)}>
          + Add Server
        </Button>
      </div>
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
      <AddServerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={(srv) => setServers((prev) => [...prev, srv])}
      />
    </>
  );
}
