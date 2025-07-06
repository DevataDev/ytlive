import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export const metadata = {
  title: "Ops Panel – Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form className="w-full max-w-sm space-y-4 rounded-md border p-6 shadow-sm bg-card">
        <h1 className="text-2xl font-semibold text-center mb-2">Operator Login</h1>
        <div className="space-y-2">
          <Input type="email" placeholder="Email" required />
          <Input type="password" placeholder="Password" required />
        </div>
        <Button type="submit" className="w-full mt-4">
          Sign in
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          <Link href="/" className="underline">Back to home</Link>
        </p>
      </form>
    </div>
  );
}
