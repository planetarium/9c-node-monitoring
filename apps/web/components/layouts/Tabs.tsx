// components/layouts/Tabs.tsx
"use client";

import { useState } from "react";
import Tab from "./Tab";
import SectionWrapper from "./SectionWrapper";

const TABS = ["ODIN", "HEIMDAL"];

export default function Tabs() {
  const [activeTab, setActiveTab] = useState("ODIN");

  return (
    <div>
      <SectionWrapper backgroundColor="bg-white">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`${
                activeTab === tab ? "bg-green-500 " : "bg-gray-200"
              } font-bold rounded-t-lg py-2 px-2.5 text-gray-800`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </SectionWrapper>
      <Tab network={activeTab} />
    </div>
  );
}
