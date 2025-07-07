"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SecretModal, { Secret } from "@/components/SecretModal";
import { cn } from "@/lib/utils";

export default function SecretListClient() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSecret, setEditSecret] = useState<Secret | null>(null);

  const fetchSecrets = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/secrets");
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setSecrets(data as Secret[]);
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, []);

  const handleSaved = (s: Secret) => {
    // If exists update else push
    setSecrets((prev) => {
      const idx = prev.findIndex((x) => x.id === s.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = s;
        return copy;
      }
      return [s, ...prev];
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this secret? This cannot be undone.")) return;
    try {
      const res = await apiFetch(`/secrets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setSecrets((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Secrets</h1>
        <Button onClick={() => { setEditSecret(null); setModalOpen(true); }}>Add Secret</Button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : secrets.length === 0 ? (
        <p>No secrets yet.</p>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Key</th>
                <th className="px-4 py-2 text-left">Created At</th>
                <th className="px-4 py-2 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {secrets.map((sec, i) => (
                <tr key={sec.id} className={cn(i % 2 === 0 && "bg-muted/50")}>
                  <td className="px-4 py-2 font-mono">{sec.key}</td>
                  <td className="px-4 py-2">{format(new Date(sec.created_at), "yyyy-MM-dd HH:mm")}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditSecret(sec); setModalOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(sec.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SecretModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editSecret={editSecret}
        onSaved={handleSaved}
      />
    </div>
  );
}
