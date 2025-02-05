import React, { useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { DayUptimeEntry } from "@/src/types";

// Chart.js 등록
ChartJS.register(ArcElement, Tooltip);

export default function UptimeDonut({
  uptime = 0,
  counts = {
    pending: 0,
    temp: 0,
    false: 0,
    true: 0,
    timeout: 0,
    delay: 0,
    total: 0,
    null: 0,
    hour: 0,
  },
}: {
  uptime: number;
  counts: DayUptimeEntry;
}) {
  // Uptime 데이터 계산
  const value = uptime;

  // 색상 설정
  const getColor = () => {
    if (value >= 95) return "rgb(74, 222, 128)"; // 초록색
    if (value > 80) return "rgb(250, 204, 21)"; // 노랑색
    return "rgb(239, 68, 68)"; // 빨강색
  };

  const data = {
    labels: ["Uptime", "Remaining"],
    datasets: [
      {
        data: [value, 100 - value], // 도넛 그래프 비율 데이터
        backgroundColor: [getColor(), "#E0E0E0"], // 상태에 따른 색상과 회색 ("#E0E0E0")
        borderWidth: 0, // 경계선 제거
      },
    ],
  };

  const options = {
    responsive: true,
    cutout: "40%", // 중앙 구멍 크기 설정
    plugins: {
      tooltip: { enabled: false }, // 툴팁 비활성화
    },
  };

  const [hoveredItem, setHoveredItem] = useState<{
    x: number;
    y: number;
    content: {
      uptime: string;
      count: string;
    };
  } | null>(null);

  const hoverContent = (uptimeData: DayUptimeEntry) => {
    return {
      uptime: `Uptime: ${uptime || 0}%`,
      count: `Total: ${uptimeData.total}, Active: ${
        uptimeData.true
      }, Delayed: ${uptimeData.delay}, Failure: ${uptimeData.false}, Timeout: ${
        uptimeData.timeout
      }, Error: ${uptimeData.pending + uptimeData.temp + uptimeData.null}`,
    };
  };

  return (
    <div
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredItem({
          x: rect.x + window.scrollX + rect.width / 2,
          y: rect.y + window.scrollY + rect.height + 8,
          content: hoverContent(counts),
        });
      }}
      onMouseLeave={() => setHoveredItem(null)}
    >
      <div style={{ position: "relative", width: "2.2rem", height: "2.2rem" }}>
        {/* 도넛 그래프 */}
        <Doughnut data={data} options={options} />
        {/* 중앙 텍스트 */}
        <div className="absolute inset-0 flex items-center justify-center text-black text-[0.85rem] font-bold z-10 ml-[1px]">
          {value}%
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
