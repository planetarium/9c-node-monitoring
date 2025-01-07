import UptimeGraph from "./UptimeGraph";
import { useEffect, useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/solid";

const generate24HourData = () =>
  Array.from({ length: 24 }, (_, i) => {
    const rand = Math.random(); // 0 ~ 1 사이의 랜덤 값

    let uptime;
    if (rand < 0.1) {
      // 10% 확률로 70 미만
      uptime = Math.floor(Math.random() * 70); // 0 ~ 69
    } else if (rand < 0.3) {
      // 20% 확률로 70 이상 95 미만
      uptime = 70 + Math.floor(Math.random() * 25); // 70 ~ 94
    } else {
      // 70% 확률로 95 이상 100 이하
      uptime = 95 + Math.floor(Math.random() * 6); // 95 ~ 100
    }

    console.log(uptime);

    return {
      label: `${i}분`,
      uptime,
    };
  });

const getColorForDay = (uptime: number) => {
  if (uptime === null) return "#e5e7eb"; // 회색 (데이터 없음)
  if (uptime >= 90) return "#4ade80"; // 초록색 (정상)
  if (uptime >= 70) return "#facc15"; // 노란색 (경고)
  return "#ef4444"; // 빨간색 (심각한 문제)
};

const getLabelForDay = (index: number) => {
  if (index == 23) return "지금";
  else if (index % 6 === 5) return `-${23 - index}시간`;
  else return "";
};

const hoverContentForDay = (item: { label: string; uptime: number }) => {
  return `Hour: ${item.label}, Uptime: ${item.uptime ?? "No data"}%`; //TODO 데이터 타입에 따라 수정
};

export default function DayUptimeGraph({
  onBarClick,
  network,
  selectedHour,
}: {
  onBarClick: (hour: number | null) => void;
  network: string;
  selectedHour: number | null;
}) {
  const [data, setData] = useState<{ label: string; uptime: number }[]>([]);

  useEffect(() => {
    const data = generate24HourData();
    setData(data);
  }, []);

  const handleToggle = () => {
    onBarClick(selectedHour ? null : 23);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{network} 24-Hour Uptime</h2>
        <button
          onClick={handleToggle}
          className={`p-1 hover:bg-gray-100 rounded-full transition-transform duration-200 ${
            selectedHour ? "rotate-90" : "rotate-0"
          }`}
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
      <UptimeGraph
        data={data}
        type="day"
        getColor={getColorForDay}
        hoverContentFormatter={hoverContentForDay}
        onBarClick={onBarClick}
      />
    </div>
  );
}
