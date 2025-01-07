import SectionWrapper from "../layouts/SectionWrapper";
import DayUptimeGraph from "./DayUptimeGraph";
import HourUptimeGraph from "./HourUptimeGraph";
import { useState } from "react";

export default function DayUptimeSection({
  network,
  node,
  isBox,
}: {
  network: string;
  node?: string;
  isBox: boolean;
}) {
  const isSection = !isBox;
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const handleGraphClick = (hour: number | null) => {
    setSelectedHour((prev) => (prev === hour ? null : hour)); // 같은 시간 클릭 시 닫기
  };

  const networkName = node ? `${network}-${node}` : network;

  return (
    <div>
      <SectionWrapper backgroundColor="bg-white" isBox={isBox}>
        <div className="pt-2 pb-4">
          <DayUptimeGraph
            onBarClick={handleGraphClick}
            selectedHour={selectedHour}
            network={networkName}
          />
        </div>
        {selectedHour !== null && (
          <div className="pt-6 pb-4">
            <HourUptimeGraph selectedHour={selectedHour} />
          </div>
        )}
        {isSection && <div className="pb-6" />}
      </SectionWrapper>
    </div>
  );
}
