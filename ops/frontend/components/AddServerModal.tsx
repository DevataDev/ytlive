"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export type Server = {
  id: string;
  name: string;
  address: string;
  status: "online" | "offline" | "unknown";
  ssh_user?: string;
  ssh_port?: number;
};

interface AddServerModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(server: Server): void;
}

export default function AddServerModal({ open, onOpenChange, onCreated }: AddServerModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [sshUser, setSshUser] = useState("root");
  const [sshPort, setSshPort] = useState(22);
  const [sshPassword, setSshPassword] = useState("");
  const [sshKeyPath, setSshKeyPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setAddress("");
    setSshUser("root");
    setSshPort(22);
    setSshPassword("");
    setSshKeyPath("");
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return; // prevent closing while submitting
    onOpenChange(false);
    reset();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/servers", {
        method: "POST",
        body: JSON.stringify({
          name,
          address,
          ssh_user: sshUser,
          ssh_port: sshPort,
          ssh_password: sshPassword,
          ssh_key_path: sshKeyPath,
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `API responded with ${res.status}`);
      }
      const created: Server = await res.json();
      onCreated(created);
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to add server");
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || !name || !address || !sshUser || (!sshPassword && !sshKeyPath);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Server</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-muted-foreground" htmlFor="name">Name</label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground" htmlFor="address">Address</label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground" htmlFor="user">SSH User</label>
              <Input id="user" value={sshUser} onChange={(e) => setSshUser(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground" htmlFor="port">SSH Port</label>
              <Input
                id="port"
                type="number"
                value={sshPort}
                onChange={(e) => setSshPort(Number(e.target.value))}
                min={1}
                max={65535}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground" htmlFor="password">SSH Password (optional)</label>
            <Input
              id="password"
              type="password"
              value={sshPassword}
              onChange={(e) => setSshPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground" htmlFor="key">SSH Key Path (optional)</label>
            <Input id="key" value={sshKeyPath} onChange={(e) => setSshKeyPath(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={disabled}>
            {submitting && <span className="mr-2 animate-spin">⏳</span>}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
