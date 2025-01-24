import React, { useState } from "react";
import dayjs from "dayjs";
import SectionWrapper from "../layouts/SectionWrapper";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
} from "@heroicons/react/24/solid";

type DayData = {
  total: number;
  true: number;
  delay: number;
  pending: number;
  thresholds: {
    pending: number;
  };
};

type MonthUptimeCalendarProps = {
  monthData?: DayData[];
  onDayClick: (day: Date) => void;
  date: Date;
};

const mockMonthData: DayData[] = Array.from({ length: 31 }).map(() => ({
  total: 100,
  true: 80,
  delay: 15,
  pending: 5,
  thresholds: {
    pending: 5,
  },
}));

const MonthUptimeCalendar: React.FC<MonthUptimeCalendarProps> = ({
  monthData = mockMonthData,
  onDayClick,
  date,
}) => {
  const [currentMonth, setCurrentMonth] = useState(dayjs(date));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfMonth = currentMonth.startOf("month").day();

  const handleMonthChange = (direction: number) => {
    setCurrentMonth(currentMonth.add(direction, "month"));
  };

  const getColorForDay = (dayData: DayData | undefined): string => {
    if (!dayData || dayData.total === 0) return "rgb(229, 231, 235)"; // 회색 (정보 없음)
    if (dayData.pending >= dayData.thresholds.pending)
      return "rgb(239, 68, 68)"; // 빨간색
    if (dayData.true + dayData.delay >= dayData.total * 0.8)
      return dayData.delay >= dayData.total * 0.25
        ? "rgb(250, 204, 21)" // 노란색 (지연)
        : "rgb(74, 222, 128)"; // 초록색 (정상)
    return "rgb(239, 68, 68)"; // 기본 빨간색
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
          <div className="absolute top-0 right-0 mt-7 bg-white p-4 rounded-b-xl flex justify-end border border-t-0 border-gray-200 drop-shadow-lg z-40">
            <div className="mb-4 w-[22.5rem]">
              <div className="bg-gray-200 pb-2 mb-4 rounded-lg">
                <div className="flex items-center justify-between mb-0 mt-4 p-4">
                  <button onClick={() => handleMonthChange(-1)}>
                    <ArrowLeftCircleIcon className="w-5 h-5" />
                  </button>
                  <h2 className="font-extrabold">
                    {currentMonth.format("MMMM YYYY")}
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
                  const dayData = monthData?.[day - 1];
                  const selectedDate = currentMonth.date(day).toDate();
                  return (
                    <div
                      key={day}
                      className="h-[3.25rem] w-[2.875rem] flex justify-center items-center cursor-pointer m-[1px]"
                      style={{ backgroundColor: getColorForDay(dayData) }}
                      onClick={() => onDayClick(selectedDate)}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionWrapper>
  );
};

export default MonthUptimeCalendar;
