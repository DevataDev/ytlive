"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Server = {
  id: string;
  name: string;
  address: string;
  status: string;
};

export default function ServerDetailTabs({ server }: { server: Server }) {
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
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-y-1">
              <span className="font-medium">Address:</span>
              <span>{server.address}</span>
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
            <div className="border rounded-md bg-black text-green-500 p-2 text-xs h-64 overflow-y-auto mb-2">
              user@{server.name}:~$&nbsp;_ <span className="opacity-75">(live shell coming soon)</span>
            </div>
            <input
              type="text"
              placeholder="Enter command"
              className="w-full rounded-md border px-3 py-1 text-sm"
              disabled
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="docker">
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Docker Containers</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1">Name</th>
                  <th className="py-1">Image</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "nginx-proxy", image: "nginx:1.25", status: "running" },
                  { name: "redis", image: "redis:7", status: "running" },
                  { name: "video-transcoder", image: "ffmpeg:latest", status: "exited" },
                ].map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="py-1">{c.name}</td>
                    <td className="py-1">{c.image}</td>
                    <td className="py-1 capitalize">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="env">
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Environment &amp; Config</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {[
                  { key: "NODE_ENV", value: "production" },
                  { key: "PORT", value: "8080" },
                  { key: "TZ", value: "UTC" },
                ].map((v) => (
                  <tr key={v.key} className="border-b last:border-0">
                    <td className="py-1 font-medium">{v.key}</td>
                    <td className="py-1">{v.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <p className="text-2xl font-semibold">12%</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Memory Used</p>
                <p className="text-2xl font-semibold">2.1&nbsp;GB</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Disk I/O</p>
                <p className="text-2xl font-semibold">150&nbsp;MB/s</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Network</p>
                <p className="text-2xl font-semibold">32&nbsp;Mbps</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Active Streams</p>
                <p className="text-2xl font-semibold">4</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Total Streams</p>
                <p className="text-2xl font-semibold">128</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Scheduled Streams</p>
                <p className="text-2xl font-semibold">12</p>
              </div>
              <div className="p-4 border rounded-md">
                <p className="font-medium">Storage Used</p>
                <p className="text-2xl font-semibold">420&nbsp;GB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </TabsRoot>
  );
}
