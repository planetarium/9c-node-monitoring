// components/layouts/Tabs.tsx
"use client";

import { useEffect, useState } from "react";
import Tab from "./Tab";
import SectionWrapper from "./SectionWrapper";
import { useTransactionCache } from "@/src/contexts/TransactionCacheContext";

const TABS = ["ODIN", "HEIMDALL"];

export default function Tabs() {
  const { fetchTransactionDataWithCache } = useTransactionCache();
  const [activeTab, setActiveTab] = useState("ODIN");
  const [date, setDate] = useState<Date>(new Date());
  const [tabBackgroundColor, setTabBackgroundColor] = useState("bg-green-500");

  useEffect(() => {
    fetchTransactionDataWithCache(activeTab, date);
  }, [activeTab, date, fetchTransactionDataWithCache]);

  return (
    <div>
      <SectionWrapper backgroundColor="bg-white">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`${
                activeTab === tab ? tabBackgroundColor : "bg-gray-200"
              } font-bold rounded-t-lg py-2 px-2.5 text-gray-800`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </SectionWrapper>
      <Tab
        network={activeTab}
        date={date}
        setDate={setDate}
        tabBackgroundColor={tabBackgroundColor}
        setTabBackgroundColor={setTabBackgroundColor}
      />
    </div>
  );
}
