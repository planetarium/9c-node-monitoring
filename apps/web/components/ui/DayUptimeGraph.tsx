import { DayUptimeEntry } from "@/src/types";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
} from "@heroicons/react/24/solid";
import { useState } from "react";
import { useNodeContext } from "@/src/contexts/NodeContext";
import { toTimezoneDateString, toTimezoneHourNumber } from "@/src/helper";

//TODO : 통계 수집 후 기준 명확화
const DAY_UPTIME_NOT_ENOUGH_DATA_THRESHOLD = 0.34; // 데이터가 34% 이상 없으면 회색
const DAY_UPTIME_PENDING_THRESHOLD = 0.1; // 지연이 10% 이상 있으면 노란색
const DAY_UPTIME_ACTIVE_THRESHOLD = 0.966; // 정상이 96.6% 이상 있으면 초록색
const DAY_UPTIME_WARNING_THRESHOLD = 0.8; // 정상이 85% 이상 있으면 주황색

const barHeight = "40px"; // gap = 10px
const barWidth = "40px";

export default function DayUptimeGraph({
  onBarClick,
  network,
  selectedHour,
  date,
  setDate,
  dayUptimeData,
}: {
  onBarClick: (hour: number | null) => void;
  network: string;
  node: string;
  selectedHour: number | null;
  date: Date;
  setDate: React.Dispatch<React.SetStateAction<Date>>;
  dayUptimeData: DayUptimeEntry[];
}) {
  //TODO : selectedHour 바뀔 때마다 렌더링 되는데, 성능 최적화 필요한지 고민
  const { nodeNames } = useNodeContext();
  const nodeNumber = nodeNames?.[network]?.length || 1;
  const maxDataNumber = 60 * nodeNumber;
  const currentTimezoneHour = toTimezoneHourNumber(date, 9);

  const getColorForDay = (dayUptimeData: DayUptimeEntry) => {
    if (!dayUptimeData || dayUptimeData.total === 0)
      return "rgb(229, 231, 235)"; // 회색 (정보 없음)
    else if (
      dayUptimeData.total <
      maxDataNumber * DAY_UPTIME_NOT_ENOUGH_DATA_THRESHOLD
    )
      return "rgb(169, 172, 178)"; // 진한 회색 (정보 적음)
    else if (
      dayUptimeData.false + dayUptimeData.timeout >
      dayUptimeData.total * DAY_UPTIME_ACTIVE_THRESHOLD
    )
      return "rgb(239, 68, 68)"; // 빨간색 (심각한 문제)
    else if (
      dayUptimeData.pending >
      dayUptimeData.total * DAY_UPTIME_PENDING_THRESHOLD
    )
      return "rgb(169, 172, 178)"; // 진한 회색 (지연 오류)
    else if (
      dayUptimeData.true >=
      dayUptimeData.total * DAY_UPTIME_ACTIVE_THRESHOLD
    )
      return "rgb(74, 222, 128)"; // 초록색 (정상)
    else if (
      dayUptimeData.true >=
      dayUptimeData.total * DAY_UPTIME_WARNING_THRESHOLD
    )
      return "rgb(250, 204, 21)"; // 노란색 (경고)
    else return "rgb(239, 68, 68)"; // 검은색 (오류). 여기까지 오면 문제가 발생한 것
  };

  const hoverContentForDay = (label: string, uptimeData: DayUptimeEntry) => {
    return {
      top: `Hour: ${label}, Uptime: ${
        uptimeData.total - uptimeData.temp >
        DAY_UPTIME_NOT_ENOUGH_DATA_THRESHOLD * maxDataNumber
          ? `${Math.round((uptimeData.true / uptimeData.total) * 100)}%`
          : "not enough data"
      }`,
      bottom: `Total: ${uptimeData.total}, Active: ${uptimeData.true}, Error: ${uptimeData.false}, Timeout: ${uptimeData.timeout}, Pending: ${uptimeData.pending}, Dashboard Failure: ${uptimeData.temp}, Null: ${uptimeData.null}`,
    }; //TODO 데이터 타입에 따라 수정
  };

  const getBarHeightForDay = (item: DayUptimeEntry) => {
    const dayMinHeight = 8;
    return `${
      dayMinHeight +
      ((parseInt(barHeight) - dayMinHeight) * (item.total - item.temp)) /
        maxDataNumber
    }px`;
  };

  const handleToggle = () => {
    if (
      date.toISOString().split("T")[0] ===
      new Date().toISOString().split("T")[0]
    ) {
      onBarClick(selectedHour ? null : currentTimezoneHour);
      console.log(currentTimezoneHour);
    } else {
      onBarClick(selectedHour ? null : 23);
    }
  };

  const handleDateChange = (prevDate: Date, change: "prev" | "next") => {
    if (change === "prev") {
      setDate(new Date(prevDate.getTime() - 24 * 60 * 60 * 1000));
    } else {
      setDate(new Date(prevDate.getTime() + 24 * 60 * 60 * 1000));
    }
  };

  const [hoveredItem, setHoveredItem] = useState<{
    x: number;
    y: number;
    content: {
      top: string;
      bottom: string;
    };
  } | null>(null);

  if (dayUptimeData.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={() => handleDateChange(date, "prev")}>
          <ArrowLeftCircleIcon className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold">
          {network} {toTimezoneDateString(date, 9)} Uptime
        </h2>
        <button onClick={() => handleDateChange(date, "next")}>
          <ArrowRightCircleIcon className="w-5 h-5" />
        </button>
        <button
          onClick={handleToggle}
          className={`p-1 hover:bg-gray-100 rounded-full transition-transform duration-200 ${
            selectedHour ? "rotate-90" : "rotate-0"
          }`}
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="mt-3">
        <div className="grid grid-cols-24">
          {dayUptimeData?.map((item, index) => (
            <div key={index} className="flex flex-col items-center">
              <div
                className="flex flex-col-reverse justify-start"
                style={{ height: barHeight }}
              >
                <div
                  key={index}
                  className="rounded cursor-pointer"
                  onClick={() => onBarClick?.(index)}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredItem({
                      x: rect.x + window.scrollX + rect.width / 2,
                      y: rect.y + window.scrollY + rect.height + 8,
                      content: hoverContentForDay(index.toString(), item),
                    });
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    width: barWidth,
                    height: getBarHeightForDay(item),
                    backgroundColor: getColorForDay(item),
                    whiteSpace: "pre-line",
                    outline:
                      selectedHour === index
                        ? `3px solid rgba(0,0,0,0.6)`
                        : "none",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {hoveredItem && (
        <div
          className="absolute bg-white p-2 rounded shadow-lg text-sm border border-gray-300"
          style={{
            left: `${hoveredItem.x}px`,
            top: `${hoveredItem.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="text-bold">{hoveredItem.content.top}</div>
          <div className="text-gray-500">{hoveredItem.content.bottom}</div>
        </div>
      )}
    </div>
  );
}
