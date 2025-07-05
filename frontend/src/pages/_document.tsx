import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';

/**
 * Custom Document file used to inject runtime environment variables into the HTML.
 *
 * The variables are placed on `window.__ENV__` so they can be read at runtime
 * by client-side code (e.g. `isSalesMode()` in `src/config/salesMode.ts`).
 */
class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    // Only expose the variables we explicitly want on the client.
    const runtimeEnv = {
      NEXT_PUBLIC_SALES_MODE: process.env.NEXT_PUBLIC_SALES_MODE ?? 'false',
    } as Record<string, string>;

    return (
      <Html lang="en">
        <Head>
          {/* Inject runtime env so it is available before any other script executes */}
          <script
            /* eslint-disable-next-line react/no-danger */
            dangerouslySetInnerHTML={{
              __html: `window.__ENV__ = ${JSON.stringify(runtimeEnv)};`,
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
