/**
 * Global <head> component for the App Router.
 * This injects runtime environment variables into `window.__ENV__` so that
 * client-side code can read them **before** React hydration begins.
 */
export default function Head() {
  const runtimeEnv = {
    NEXT_PUBLIC_SALES_MODE: process.env.NEXT_PUBLIC_SALES_MODE ?? 'false',
  } as Record<string, string>;

  return (
    <>
      {/* Make runtime env available on the client */}
      {/* eslint-disable-next-line react/no-danger */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__ENV__ = ${JSON.stringify(runtimeEnv)};`,
        }}
      />
    </>
  );
}
