import React, { useState, useEffect, useCallback, useMemo } from "react";
import dayjs from "dayjs";
import SectionWrapper from "../layouts/SectionWrapper";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
} from "@heroicons/react/24/solid";
import { useTimeZoneContext } from "@/src/contexts/TimezoneContext";
import { useNodeContext } from "@/src/contexts/NodeContext";

type DayData = {
  localDate: "string";
  active: number;
  total: number;
};

type MonthDataByNetwork = Record<string, Record<string, DayData[]>>;

type MonthUptimeCalendarProps = {
  monthData?: Record<string, DayData[]>;
  onDayClick: (day: Date) => void;
  date: Date;
  network: string;
};

const MONTH_UPTIME_NOT_ENOUGH_DATA_THRESHOLD = 0.1; // 데이터가 10% 이상 없으면 회색
const MONTH_UPTIME_ACTIVE_THRESHOLD = 0.95; // 정상이 100%인 경우에만 초록색
const MONTH_UPTIME_WARNING_THRESHOLD = 0.8; // 정상이 80% 이상 있으면 노란색

const MonthUptimeCalendar: React.FC<MonthUptimeCalendarProps> = ({
  onDayClick,
  date,
  network,
}) => {
  const [currentMonth, setCurrentMonth] = useState(dayjs(date));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [monthData, setMonthData] = useState<MonthDataByNetwork>({});
  const [hoveredItem, setHoveredItem] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);

  const currentMonthKey = currentMonth.format("YYYY-MM");

  const { userTimeZone } = useTimeZoneContext();
  const { nodeNames } = useNodeContext();

  const lowerCaseNetwork = useMemo(() => {
    return network.toLowerCase();
  }, [network]);

  const nodeNumber = nodeNames?.[lowerCaseNetwork]?.length || 1;
  const currentNetworkData = useMemo(() => {
    return monthData[lowerCaseNetwork] || {};
  }, [monthData, lowerCaseNetwork]);
  const hasMonthData = !!currentNetworkData[currentMonthKey];

  const fetchMonthData = useCallback(
    async (monthKey: string) => {
      try {
        // monthKey: "YYYY-MM"
        const [yearStr, monthStr] = monthKey.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);

        if (!year || !month || isNaN(year) || isNaN(month)) {
          console.error("Invalid year or month:", year, month);
          return;
        }

        console.log("Fetching data for:", monthKey, userTimeZone);

        // 예시 API: /transactions/summary?year=2025&month=1&timezone=Asia/Seoul
        const response = await fetch(
          `${process.env.NEXT_API_URL}/transactions/summary?year=${year}&month=${month}&timezone=${userTimeZone}&network=${lowerCaseNetwork}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }

        const data = await response.json();
        console.log("Fetched data:", monthKey, data);

        setMonthData((prevData) => ({
          ...prevData,
          [lowerCaseNetwork]: {
            ...(prevData[lowerCaseNetwork] || {}), // 혹시 기존에 다른 monthKey들이 있을 수 있으므로
            [monthKey]: data,
          },
        }));
      } catch (error) {
        console.error("Error fetching month data:", error);
      }
    },
    [userTimeZone, lowerCaseNetwork]
  );

  /**
   * currentMonth 변경될 때마다:
   * 1) 현재 달 데이터가 없으면 fetch
   * 2) 이전 달 데이터도 없으면 백그라운드로 fetch
   */
  useEffect(
    () => {
      // 1) 현재 달
      if (!hasMonthData) {
        fetchMonthData(currentMonthKey);
      }

      // 2) 이전 달
      const prevMonthKey = currentMonth
        .clone()
        .subtract(1, "month")
        .format("YYYY-MM");
      if (!(prevMonthKey in currentNetworkData)) {
        fetchMonthData(prevMonthKey);
      }

      const nextMonthKey = currentMonth
        .clone()
        .add(1, "month")
        .format("YYYY-MM");
      if (!(nextMonthKey in currentNetworkData)) {
        fetchMonthData(nextMonthKey);
      }
    }, // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentMonth,
      currentMonthKey,
      hasMonthData,
      fetchMonthData,
      lowerCaseNetwork,
    ]
  );

  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfMonth = currentMonth.startOf("month").day();

  const handleMonthChange = (direction: number) => {
    setCurrentMonth(currentMonth.add(direction, "month"));
  };

  const getColorForDay = (dayData: DayData | undefined): string => {
    if (!dayData || dayData.total === 0) return "rgb(229, 231, 235)"; // 회색 (정보 없음)
    if (
      dayData.total <=
      nodeNumber * 24 * 60 * MONTH_UPTIME_NOT_ENOUGH_DATA_THRESHOLD
    )
      return "rgb(169, 172, 178)";
    if (dayData.active >= dayData.total * MONTH_UPTIME_ACTIVE_THRESHOLD)
      return "rgb(74, 222, 128)";
    if (dayData.active >= dayData.total * MONTH_UPTIME_WARNING_THRESHOLD)
      return "rgb(250, 204, 21)";
    return "rgb(239, 68, 68)";
  };

  const getHoverContent = (dayData: DayData | undefined): string => {
    if (!dayData || dayData.total === 0) return "no data found"; // 회색 (정보 없음)
    if (
      dayData.total <=
      nodeNumber * 24 * 60 * MONTH_UPTIME_NOT_ENOUGH_DATA_THRESHOLD
    )
      return "not enough data";

    return (
      "Uptime : " + ((dayData.active / dayData.total) * 100).toFixed(1) + "%"
    );
  };

  return (
    <SectionWrapper>
      <div className="relative">
        <div className="flex items-center justify-end mt-2">
          <div className="font-bold text-gray-600">Monthly Uptime</div>
          <button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className={`p-1 hover:bg-gray-100 rounded-full transition-transform duration-200 text-gray-800 ${
              isCalendarOpen ? "rotate-90" : "rotate-0"
            }`}
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
        {isCalendarOpen && (
          <div className="flex justify-center">
            {/* absolute top-0 right-0 */}
            <div className="w-[25.5rem] mt-4 bg-white p-4 rounded-b-xl flex justify-end z-40">
              {" "}
              {/* border border-t-0 border-gray-200 drop-shadow-lg  */}
              <div className="mb-4">
                <div className="bg-gray-200 pb-2 mb-4 rounded-lg">
                  <div className="flex items-center justify-between mb-0 mt-4 p-4">
                    <button onClick={() => handleMonthChange(-1)}>
                      <ArrowLeftCircleIcon className="w-5 h-5" />
                    </button>
                    <h2 className="font-extrabold">
                      {`${network} - ${currentMonth.format("MMMM YYYY")}`}
                    </h2>
                    <button onClick={() => handleMonthChange(1)}>
                      <ArrowRightCircleIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <div key={day} className="font-semibold">
                          {day}
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {/* 빈 칸 렌더링 */}
                  {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                    <div key={index}></div>
                  ))}

                  {/* 날짜 렌더링 */}
                  {Array.from({ length: daysInMonth }).map((_, dayIndex) => {
                    const day = dayIndex + 1;
                    const dayData =
                      currentNetworkData[currentMonthKey]?.[day - 1] ?? null;
                    const selectedDate = currentMonth.date(day).toDate();
                    return (
                      <div
                        key={day}
                        className="h-[3.39rem] w-[3rem] flex justify-center items-center cursor-pointer m-[1px]"
                        style={{
                          backgroundColor: dayData
                            ? getColorForDay(dayData)
                            : "rgb(255,255,255)",
                        }}
                        onMouseEnter={(e) => {
                          // (1) 부모 컨테이너의 좌표(=relative 기준점)부터 가져오기
                          //    offsetParent가 null이면(부모가 없는 특수 케이스) 대비 필요
                          const containerRect =
                            e.currentTarget.offsetParent?.getBoundingClientRect();
                          // (2) 현재 hover된 셀의 좌표(=뷰포트 기준)
                          const rect = e.currentTarget.getBoundingClientRect();

                          if (!containerRect) return;

                          // (3) '툴팁을 셀의 아래 중앙'에 위치시키기 위해
                          //     부모 컨테이너의 좌표를 빼서 relative 기준 좌표로 맞춤
                          const x =
                            rect.left - containerRect.left + rect.width / 2;
                          const y = rect.bottom - containerRect.top + 4;

                          setHoveredItem({
                            x,
                            y,
                            content: getHoverContent(dayData),
                          });
                        }}
                        onMouseLeave={() => setHoveredItem(null)}
                        onClick={() => onDayClick(selectedDate)}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        {hoveredItem && (
          <div
            className="absolute bg-white p-2 rounded shadow-lg text-sm border border-gray-300 z-50"
            style={{
              left: `${hoveredItem.x}px`,
              top: `${hoveredItem.y}px`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="text-bold">{hoveredItem.content}</div>
          </div>
        )}
      </div>
    </SectionWrapper>
  );
};

export default MonthUptimeCalendar;
