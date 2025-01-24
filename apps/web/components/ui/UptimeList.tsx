import { useState } from "react";
import DayUptimeSection from "./DayUptimeSection";
import { useNodeContext } from "@/src/contexts/NodeContext";

export default function UptimeList({
  network,
  date,
  setDate,
}: {
  network: string;
  date: Date;
  setDate: React.Dispatch<React.SetStateAction<Date>>;
}) {
  const { nodeNames } = useNodeContext();
  const nodes = nodeNames[network];
  const [globalSelectedHour, setGlobalSelectedHour] = useState<number | null>(
    null
  );

  return (
    <div style={{ backgroundColor: "var(--background)" }}>
      <div className="mb-8">
        <DayUptimeSection
          network={network}
          isBox={false}
          date={date}
          setDate={setDate}
          globalSelectedHour={globalSelectedHour}
          setGlobalSelectedHour={setGlobalSelectedHour}
        />
      </div>
      <div className="pb-2">
        {nodes?.map((node: string, index: number) => (
          <div className="mb-4" key={index}>
            <DayUptimeSection
              network={network}
              node={node}
              isBox={true}
              date={date}
              setDate={setDate}
              globalSelectedHour={globalSelectedHour}
              setGlobalSelectedHour={setGlobalSelectedHour}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
