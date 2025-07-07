"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import useSWR from "swr";
import { useState } from "react";
import dynamic from "next/dynamic";
import DeploymentModal from "@/components/DeploymentModal";
import AgentDeployModal from "@/components/AgentDeployModal";
const Terminal = dynamic(() => import("@/components/terminal/Terminal"), { ssr: false });
const backend = process.env.NEXT_PUBLIC_OPS_BACKEND_URL || "";
const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
};

function ShellTerminal({ serverId }: { serverId: string }) {
  const backend = process.env.NEXT_PUBLIC_OPS_BACKEND_URL || "";
  if (!backend) return <p className="text-red-500">Backend URL not set</p>;
  let origin: string;
  try {
    origin = new URL(backend).origin; // strip any path like /api
  } catch {
    origin = backend;
  }
  const wsUrl = origin.replace(/^http/, "ws") + `/ws/shell?server=${serverId}`;
  return <Terminal wsUrl={wsUrl} />;
}

type Server = {
  id: string;
  name: string;
  address: string;
  status: string;
  domain?: string;
  // metrics (optional)
  cpu_percent?: number;
  mem_used_mb?: number;
  net_mbps?: number;
  disk_used_mb?: number;
  streams_active?: number;
  streams_total?: number;
  streams_sched?: number;
};

function DockerTable({ serverId }: { serverId: string }) {
  const { data, isLoading, error } = useSWR(backend + `/servers/${serverId}/docker`, fetcher, { refreshInterval: 30000 });
  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Failed to load</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-1">Name</th>
          <th className="py-1">Image</th>
          <th className="py-1">Status</th>
          <th className="py-1">Ports</th>
          <th className="py-1">Uptime</th>
        </tr>
      </thead>
      <tbody>
        {data?.map((c: any) => (
          <tr key={c.name} className="border-b last:border-0">
            <td className="py-1">{c.name}</td>
            <td className="py-1">{c.image}</td>
            <td className="py-1 capitalize">{c.status}</td>
            <td className="py-1">{c.ports}</td>
            <td className="py-1">{c.uptime}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EnvTable({ serverId }: { serverId: string }) {
  const { data, isLoading, error } = useSWR(backend + `/servers/${serverId}/env`, fetcher, { refreshInterval: 60000 });
  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Failed to load</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {Object.entries(data || {}).map(([k, v]) => (
          <tr key={k} className="border-b last:border-0">
            <td className="py-1 font-medium">{k}</td>
            <td className="py-1 break-all">{v as string}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ServerDetailTabs({ server }: { server: Server }) {
  const [depOpen, setDepOpen] = useState(false);
  const [agentDepOpen, setAgentDepOpen] = useState(false);
  return (
    <TabsRoot defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="shell">Shell</TabsTrigger>
        <TabsTrigger value="docker">Docker</TabsTrigger>
        <TabsTrigger value="env">Env / Config</TabsTrigger>
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">Overview
              <span className="space-x-2">
                <button onClick={() => setDepOpen(true)} className="text-sm underline">Deploy App</button>
                <button onClick={() => setAgentDepOpen(true)} className="text-sm underline">Deploy Agent</button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-y-1">
              <span className="font-medium">Address:</span>
              <span>{server.address}</span>
              {server.domain && (
              <>
                <span className="font-medium">Domain:</span>
                <span>{server.domain}</span>
              </>
            )}
              <span className="font-medium">Status:</span>
              <span className="capitalize">{server.status}</span>
              <span className="font-medium">OS:</span>
              <span>Ubuntu 22.04</span>
              <span className="font-medium">Uptime:</span>
              <span>34&nbsp;days</span>
              <span className="font-medium">Load Avg:</span>
              <span>0.24&nbsp;/&nbsp;0.31&nbsp;/&nbsp;0.28</span>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="shell">
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Interactive Shell</CardTitle>
          </CardHeader>
          <CardContent>
            {/* live terminal */}
            <ShellTerminal serverId={server.id} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="docker">
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Docker Containers</CardTitle>
          </CardHeader>
          <CardContent>
            {!backend && (<p className="text-red-500">Backend URL not set</p>)}
            {backend && (
              <DockerTable serverId={server.id} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="env">
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Environment &amp; Config</CardTitle>
          </CardHeader>
          <CardContent>
            {!backend && (<p className="text-red-500">Backend URL not set</p>)}
            {backend && (<EnvTable serverId={server.id} />)}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="metrics">
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Metrics (last 24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 border rounded-md">
                <p className="font-medium">CPU Usage</p>
                <p className="text-2xl font-semibold">{server.cpu_percent?.toFixed(1) ?? '-'}%</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Memory Used</p>
                <p className="text-2xl font-semibold">{(server.mem_used_mb ? (server.mem_used_mb/1024).toFixed(1) : '-')}&nbsp;GB</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Network</p>
                <p className="text-2xl font-semibold">{server.net_mbps?.toFixed(1) ?? '-'}&nbsp;Mbps</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Active Streams</p>
                <p className="text-2xl font-semibold">{server.streams_active}</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Total Streams</p>
                <p className="text-2xl font-semibold">{server.streams_total}</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Scheduled Streams</p>
                <p className="text-2xl font-semibold">{server.streams_sched}</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Storage Used</p>
                <p className="text-2xl font-semibold">{(server.disk_used_mb ? (server.disk_used_mb/1024).toFixed(1) : '-')}&nbsp;GB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
          <DeploymentModal open={depOpen} onOpenChange={setDepOpen} serverId={server.id} />
      <AgentDeployModal open={agentDepOpen} onOpenChange={setAgentDepOpen} serverId={server.id} />
    </TabsRoot>
  );
}
