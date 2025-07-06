import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/login");
  return null;
}

/* old placeholder
export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-bold text-gray-800">Ops Panel coming soon…</h1>
    </div>
  );
}
*/
