import UptimeGraph from "./UptimeGraph";
import { useEffect, useState } from "react";

const generate60MinuteData = () =>
  Array.from({ length: 60 }, (_, i) => {
    const rand = Math.random(); // 0 ~ 1 사이의 랜덤 값

    let uptime;
    if (rand < 0.1) {
      // 10% 확률로 70 미만
      uptime = 0;
    } else {
      // 90% 확률로 100
      uptime = 100;
    }

    return {
      label: `${i}분`,
      uptime,
    };
  });

const getColorForHour = (uptime: number | null) => {
  if (uptime === null) return "#e5e7eb"; // 회색 (데이터 없음)
  if (uptime >= 95) return "#10b981"; // 초록색 (정상)
  if (uptime >= 70) return "#facc15"; // 노란색 (경고)
  return "#ef4444"; // 빨간색 (심각한 문제)
};

const getLabelForHour = (index: number) => {
  if (index % 10 === 0 && index !== 0) return `${index}`;
  else return "";
};

export default function HourUptimeGraph({
  selectedHour,
}: {
  selectedHour: number;
}) {
  const [data, setData] = useState<{ label: string; uptime: number }[]>([]);

  useEffect(() => {
    const data = generate60MinuteData();
    setData(data);
  }, [selectedHour]);

  return (
    <div className="-mb-1">
      <h3 className="text-lg font-semibold">
        {selectedHour}:00 - {selectedHour + 1}:00 Uptime
      </h3>
      <UptimeGraph
        data={data}
        type="hour"
        barWidth="13px"
        barHeight="30px"
        getColor={getColorForHour}
        customLabelRenderer={getLabelForHour}
        hoverContentFormatter={(item) =>
          `Minute: ${item.label}, Uptime: ${item.uptime ?? "No data"}%`
        }
      />
    </div>
  );
}
