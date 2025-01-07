import { useState } from "react";

interface UptimeGraphProps {
  data: { label: string; uptime: number }[];
  type: "hour" | "day";
  getColor: (uptime: number) => string; // 막대 색상 기준 함수
  hoverContentFormatter: (item: { label: string; uptime: number }) => string; // 마우스 오버 시 표시할 내용
  customLabelRenderer?: (index: number) => string; // 라벨 렌더링
  barWidth?: string; // 막대 너비
  barHeight?: string; // 막대 높이
  gap?: string; // 막대 간격
  onBarClick?: (index: number) => void; // 막대 클릭 이벤트 핸들러
}

export default function UptimeGraph({
  data,
  type,
  getColor,
  hoverContentFormatter,
  onBarClick,
  customLabelRenderer,
  barWidth = "40px",
  barHeight = type === "day" ? "40px" : "30px",
  gap = "10px",
}: UptimeGraphProps) {
  const [hoveredItem, setHoveredItem] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);

  const getBarHeight = (type: "day" | "hour", uptime: number) => {
    const minHeight = 8;
    if (type === "day")
      return `${
        minHeight + (parseInt(barHeight) - minHeight) * (uptime / 100)
      }px`;
    else
      return `${
        minHeight + (parseInt(barHeight) - minHeight) * (1 - uptime / 100)
      }px`;
  };

  return (
    <div className="mt-3">
      <div
        className={`grid ${type === "day" ? "grid-cols-24" : "grid-cols-60"}`}
      >
        {data.map((item, index) => (
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
                    content: hoverContentFormatter(item),
                  });
                }}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  width: barWidth,
                  height: getBarHeight(type, item.uptime),
                  backgroundColor: getColor(item.uptime),
                }}
              />
            </div>
            <span className="text-sm text-center max-w-[13px] whitespace-nowrap mt-1">
              {customLabelRenderer ? customLabelRenderer(index) : ""}
            </span>
          </div>
        ))}
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
          {hoveredItem.content}
        </div>
      )}
    </div>
  );
}
