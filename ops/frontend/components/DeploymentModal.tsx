"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  serverId: string;
}

export default function DeploymentModal({ open, onOpenChange, serverId }: Props) {
  const [deployId, setDeployId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // auto scroll
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Start deployment when modal opened first time
  useEffect(() => {
    if (!open) return;
    if (status !== "idle") return;

    (async () => {
      setStatus("running");
      try {
        const res = await apiFetch(`/servers/${serverId}/deploy`, { method: "POST" });
        if (!res.ok) throw new Error(`Deploy start failed: ${res.status}`);
        const data = await res.json();
        setDeployId(data.id);
      } catch (err: any) {
        setError(err.message || "Failed to start deployment");
        setStatus("failed");
      }
    })();
  }, [open, serverId, status]);

  // Stream logs
  useEffect(() => {
    if (!deployId) return;
    const base = process.env.NEXT_PUBLIC_OPS_BACKEND_URL ?? "http://localhost:8080";
    const token = getToken();
    const es = new EventSource(`${base}/deployments/${deployId}/stream?token=${token}`, { withCredentials: true });
    es.onmessage = (ev) => {
      setLogs((prev) => [...prev, ev.data]);
      if (ev.data === "DONE") {
        setStatus("success");
        es.close();
      }
    };
    es.onerror = (e) => {
      console.error("SSE error", e);
      setError("Connection lost");
      setStatus("failed");
      es.close();
    };
    return () => es.close();
  }, [deployId]);

  const title = status === "success" ? "Deployment Finished" : status === "failed" ? "Deployment Error" : "Deploying";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div
          ref={logRef}
          className="h-80 overflow-y-auto bg-black text-green-400 font-mono text-xs p-2 rounded-md border"
        >
          {logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{status === "running" ? "Close" : "Done"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
