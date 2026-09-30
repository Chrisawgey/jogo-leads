import Head from "next/head";
import { Toaster } from "react-hot-toast";
import LeadsLayout from "../components/LeadsLayout";
import "@/styles/globals.css";
import "leaflet/dist/leaflet.css";

export default function App({ Component, pageProps, router }) {
  const isLogin = router.pathname === "/login";

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      {isLogin ? (
        <Component {...pageProps} />
      ) : (
        <LeadsLayout userName={pageProps.userName}>
          <Component {...pageProps} />
        </LeadsLayout>
      )}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            fontSize: "14px",
            maxWidth: "90vw",
            padding: "10px 16px",
            borderRadius: "10px",
          },
        }}
      />
    </>
  );
}
