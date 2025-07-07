'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveToken } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_OPS_BACKEND_URL ?? 'http://localhost:8080';
      const response = await fetch(apiBase + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError('Invalid credentials');
        return;
      }
      const { token } = await response.json();
      saveToken(token);
      router.push('/dashboard');
    } catch (error) {
      setError('Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-md border p-6 shadow-sm bg-card">
        <h1 className="text-2xl font-semibold text-center mb-2">Operator Login</h1>
        <div className="space-y-2">
          <Input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        </div>
        <Button type="submit" disabled={loading} className="w-full mt-4">
          Sign in
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          <Link href="/" className="underline">Back to home</Link>
        </p>
      {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
      </form>
    </div>
  );
}
