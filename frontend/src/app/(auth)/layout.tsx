export const metadata = {
  title: 'Sign In - YukLive!',
  description: 'Sign in to your account',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        {children}
      </div>
    </main>
  );
}