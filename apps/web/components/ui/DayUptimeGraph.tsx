import { DayUptimeEntry } from "@/src/types";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
} from "@heroicons/react/24/solid";
import UptimeDonut from "./UptimeDonut";
import { useEffect, useState, useMemo } from "react";
import { useNodeContext } from "@/src/contexts/NodeContext";
import { useTimeZoneContext } from "@/src/contexts/TimezoneContext";
import { toTimezoneDateString, toTimezoneHourNumber } from "@/src/helper";

//TODO : 통계 수집 후 기준 명확화
const DAY_UPTIME_NOT_ENOUGH_DATA_THRESHOLD = 0.25; // 데이터가 25% 이상 없으면 회색
const DAY_UPTIME_PENDING_COUNT_THRESHOLD = 5; // 보류가 5개 이상 있으면 빨간색 (일반적으로 3분 이상 지났으면 failed 처리하므로 3개 이하)
const DAY_UPTIME_DELAY_THRESHOLD = 0.25; //25% 이상 지연됐다면 노란색
const DAY_UPTIME_ACTIVE_THRESHOLD = 1; // 정상이 100%인 경우에만 초록색
const DAY_UPTIME_WARNING_THRESHOLD = 0.8; // 정상이 80% 이상 있으면 노란색

export default function DayUptimeGraph({
  onBarClick,
  network,
  selectedHour,
  date,
  setDate,
  dayUptimeData,
  isBox,
}: {
  onBarClick: (hour: number | null) => void;
  network: string;
  node: string;
  selectedHour: number | null;
  date: Date;
  setDate: React.Dispatch<React.SetStateAction<Date>>;
  dayUptimeData: DayUptimeEntry[];
  isBox: boolean;
}) {
  const { nodeNames } = useNodeContext();
  const { userTimeZone } = useTimeZoneContext();
  const nodeNumber = nodeNames?.[network]?.length || 1;
  const maxDataNumber = 60 * nodeNumber;
  const currentTimezoneHour = toTimezoneHourNumber(date, userTimeZone);
  const [barHeight, setBarHeight] = useState("40px");
  const [outlineWidth, setOutlineWidth] = useState("3px");

  useEffect(() => {
    const updateHeight = () => {
      const width = window.innerWidth;
      if (width < 410) {
        setBarHeight("25px");
        setOutlineWidth("1px");
      } else if (width < 540) {
        setBarHeight("30px");
        setOutlineWidth("1px");
      } else if (width < 768) {
        setBarHeight("35px");
        setOutlineWidth("2px");
      } else if (width < 1024) {
        setBarHeight("45px");
        setOutlineWidth("3px");
      } else {
        setBarHeight("50px");
        setOutlineWidth("3px");
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const getColorForDay = (dayUptimeData: DayUptimeEntry) => {
    const meaningfulDayUpdimeDataCount =
      dayUptimeData.total - dayUptimeData.temp - dayUptimeData.pending; //전송 실패 및 보류는 데이터로 취급되지 않는다.
    if (!dayUptimeData || dayUptimeData.total === 0)
      return "rgb(229, 231, 235)"; // 회색 (정보 없음)
    else if (
      meaningfulDayUpdimeDataCount <
      maxDataNumber * DAY_UPTIME_NOT_ENOUGH_DATA_THRESHOLD
    )
      return "rgb(169, 172, 178)"; // 진한 회색 (정보 적음)
    else if (
      dayUptimeData.pending >=
      nodeNumber * DAY_UPTIME_PENDING_COUNT_THRESHOLD //노드별로 THRESHOLD개 만큼까지만 허용
    )
      return "rgb(239, 68, 68)"; // 빨간색 (pending 처리되지 않는 심각한 문제)
    else if (
      dayUptimeData.true + dayUptimeData.delay >=
      meaningfulDayUpdimeDataCount * DAY_UPTIME_ACTIVE_THRESHOLD
    )
      return dayUptimeData.delay >=
        meaningfulDayUpdimeDataCount * DAY_UPTIME_DELAY_THRESHOLD
        ? "rgb(250, 204, 21)" // 노란색 (전부 정상적이어도 일부가 지연됐다면 경고)
        : "rgb(74, 222, 128)";
    // 초록색 (정상)
    else if (
      dayUptimeData.true + dayUptimeData.delay >=
      meaningfulDayUpdimeDataCount * DAY_UPTIME_WARNING_THRESHOLD
    )
      return "rgb(250, 204, 21)"; // 노란색 (경고)
    else return "rgb(239, 68, 68)"; // 빨간색 (오류 개수 허용치 이상) or (true가 경고 범위 아래)
  };

  const useDayUptimeCount = (dayUptimeData: DayUptimeEntry[]) => {
    const dayUptimeCount = useMemo(() => {
      return dayUptimeData.reduce(
        (acc, curr) => ({
          pending: acc.pending + curr.pending,
          temp: acc.temp + curr.temp,
          false: acc.false + curr.false,
          true: acc.true + curr.true,
          timeout: acc.timeout + curr.timeout,
          delay: acc.delay + curr.delay,
          total: acc.total + curr.total,
          null: acc.null + curr.null,
          hour: 0,
        }),
        {
          pending: 0,
          temp: 0,
          false: 0,
          true: 0,
          timeout: 0,
          delay: 0,
          total: 0,
          null: 0,
          hour: 0,
        }
      );
    }, [dayUptimeData]);

    return dayUptimeCount;
  };

  const hoverContentForDay = (label: string, uptimeData: DayUptimeEntry) => {
    const meaningfulDataCount =
      uptimeData.total - uptimeData.temp - uptimeData.pending;
    const uptime =
      meaningfulDataCount > 0
        ? (
            ((uptimeData.delay + uptimeData.true) / meaningfulDataCount) *
            100
          ).toFixed(1)
        : 0;
    return {
      uptime: `Hour: ${label}, Uptime: ${
        meaningfulDataCount >
        DAY_UPTIME_NOT_ENOUGH_DATA_THRESHOLD * maxDataNumber
          ? `${uptime || 0}%`
          : `(${uptime || 0}%) - not enough data `
      }`,
      count: `Total: ${uptimeData.total}, Active: ${
        uptimeData.true
      }, Delayed: ${uptimeData.delay}, Failure: ${uptimeData.false}, Timeout: ${
        uptimeData.timeout
      }, Error: ${uptimeData.pending + uptimeData.temp + uptimeData.null}`,
    };
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
      // console.log(currentTimezoneHour);
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
      uptime: string;
      count: string;
    };
  } | null>(null);

  const dayUptimeCount = useDayUptimeCount(dayUptimeData);
  const meaningfulUptimeCount =
    dayUptimeCount.total - dayUptimeCount.temp - dayUptimeCount.pending;
  const overallUptime =
    meaningfulUptimeCount > 0
      ? parseFloat(
          (
            ((dayUptimeCount.true + dayUptimeCount.delay) /
              meaningfulUptimeCount) *
            100
          ).toFixed(1)
        )
      : 0;

  if (dayUptimeData.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={() => handleDateChange(date, "prev")}>
          <ArrowLeftCircleIcon className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold">
          {isBox
            ? `${network}`
            : `${network} ${toTimezoneDateString(date, userTimeZone)} Uptime`}
        </h2>
        <button onClick={() => handleDateChange(date, "next")}>
          <ArrowRightCircleIcon className="w-5 h-5" />
        </button>
        <div className="ml-1.5">
          <UptimeDonut uptime={overallUptime} counts={dayUptimeCount} />
        </div>
        {isBox && (
          <button
            onClick={handleToggle}
            className={`p-1 hover:bg-gray-100 rounded-full transition-transform duration-200 ${
              selectedHour ? "rotate-90" : "rotate-0"
            }`}
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        )}
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
                  className="rounded cursor-pointer w-[10px] min-[410px]:w-[12px] min-[540px]:w-[15px] min-[660px]:w-[19px] md:w-[23px] lg:w-[32px] xl:w-[40px]"
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
                    height: getBarHeightForDay(item),
                    backgroundColor: getColorForDay(item),
                    whiteSpace: "pre-line",
                    outline:
                      selectedHour === index
                        ? `${outlineWidth} solid rgba(0,0,0,0.6)`
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
          className="absolute bg-white p-2 rounded shadow-lg text-sm border border-gray-300 z-50"
          style={{
            left: `${hoveredItem.x}px`,
            top: `${hoveredItem.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="text-bold">{hoveredItem.content.uptime}</div>
          <div className="text-gray-500">{hoveredItem.content.count}</div>
        </div>
      )}
    </div>
  );
}
