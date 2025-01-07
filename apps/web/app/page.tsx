// app/page.tsx
"use client";

import Tabs from "@/components/layouts/Tabs";

export default function MainPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-center bg-white pb-4 pt-10">
        Network Health Dashboard
      </h1>
      <Tabs />
    </>
  );
}
