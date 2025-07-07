"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export type Secret = {
  id: string;
  key: string;
  created_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editSecret?: Secret | null;
  onSaved: (s: Secret) => void;
};

export default function SecretModal({ open, onOpenChange, editSecret, onSaved }: Props) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editSecret) {
      setKey(editSecret.key);
    } else {
      setKey("");
    }
    setValue("");
    setError(null);
  }, [editSecret, open]);

  const handleClose = () => {
    if (!submitting) onOpenChange(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const method = editSecret ? "PUT" : "POST";
      const path = editSecret ? `/secrets/${editSecret.id}` : "/secrets";
      const payload: Record<string, any> = { value };
      if (!editSecret) payload.key = key;
      else if (key !== editSecret.key) payload.key = key;
      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `API responded with ${res.status}`);
      }
      const saved: Secret = await res.json();
      onSaved(saved);
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || key.trim() === "" || value.trim() === "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{editSecret ? "Edit Secret" : "Add Secret"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="key" className="text-sm font-medium">
              Key
            </label>
            <Input
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="MY_SECRET_KEY"
              disabled={!!editSecret}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="value" className="text-sm font-medium">
              Value
            </label>
            <Input
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="supersecretvalue"
              type="password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={disabled}>
            {submitting && <span className="mr-2 animate-spin">⏳</span>}
            {editSecret ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
