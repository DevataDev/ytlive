

import Link from "next/link";
import ServerDetailTabs from "@/components/ServerDetailTabs";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getToken } from "@/lib/auth";

type Server = {
  id: string;
  name: string;
  address: string;
  status: string;
  ssh_user?: string;
  ssh_port?: number;
};

type Props = { params: Promise<{ serverId: string }> };

export const metadata = { title: "Server Details" };

export default async function ServerPage({ params }: Props) {
  const { serverId } = await params;
  const cookieStore = await cookies();
  const jwt = cookieStore.get('ops_jwt')?.value || getToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_OPS_BACKEND_URL ?? 'http://localhost:8080'}/servers/${serverId}`, {
    cache: 'no-store',
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    credentials: 'include',
  });
  if (!res.ok) return notFound();
  const server: Server = await res.json();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{server.name}</h1>
        <Link href="/dashboard" className="text-sm underline">
          ← Back
        </Link>
      </div>

      <ServerDetailTabs server={server} />
    </div>
  );
}