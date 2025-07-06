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
            <div>
              <span className="font-medium">Address:</span> {server.address}
            </div>
            <div>
              <span className="font-medium">Status:</span> {server.status}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="shell">
        <Card className="mt-4">
          <CardContent>SSH shell coming soon.</CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="docker">
        <Card className="mt-4">
          <CardContent>Docker actions coming soon.</CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="env">
        <Card className="mt-4">
          <CardContent>Environment &amp; Config management coming soon.</CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="metrics">
        <Card className="mt-4">
          <CardContent>Metrics charts coming soon.</CardContent>
        </Card>
      </TabsContent>
    </TabsRoot>
  );
}
