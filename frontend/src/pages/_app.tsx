import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Web3Provider } from '@/context/Web3Context';
import Layout from '@/components/common/Layout';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Web3Provider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </Web3Provider>
  );
}