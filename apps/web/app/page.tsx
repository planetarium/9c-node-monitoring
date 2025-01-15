// app/page.tsx
"use client";

import Tabs from "@/components/layouts/Tabs";
import { TransactionCacheProvider } from "@/src/contexts/TransactionCacheContext";
import { NodeContextProvider } from "@/src/contexts/NodeContext";
import { LoadingContextProvider } from "@/src/contexts/LoadingContext";

export default function MainPage() {
  return (
    <LoadingContextProvider>
      <TransactionCacheProvider>
       <NodeContextProvider>
          <h1 className="text-2xl font-bold text-center bg-white pb-4 pt-10">
            Network Health Dashboard
          </h1>
          <Tabs />
        </NodeContextProvider>
      </TransactionCacheProvider>
    </LoadingContextProvider>
  );
}
