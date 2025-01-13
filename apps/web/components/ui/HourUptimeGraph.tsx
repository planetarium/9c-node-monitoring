import { TransactionData } from "@/src/types";
import { useState } from "react";

// const generate60MinuteData = () =>
//   Array.from({ length: 60 }, (_, i) => {
//     const rand = Math.random(); // 0 ~ 1 사이의 랜덤 값

//     let uptime;
//     if (rand < 0.1) {
//       // 10% 확률로 70 미만
//       uptime = 0;
//     } else {
//       // 90% 확률로 100
//       uptime = 100;
//     }

//     return {
//       label: `${i}분`,
//       uptime,
//     };
//   });

const barHeight = "30px"; // gap = 10px
const barWidth = "13px";

const getColorForHour = (item: TransactionData) => {
  //TODO 데이터 타입에 따라 색 기준 결정
  if (item.active === "true") return "rgb(74, 222, 128)"; // 초록색 (정상)
  if (item.active === "temp") return "rgb(189, 193, 199)"; // 회색 (대시보드 실패)
  if (item.active === "false") return "rgb(239, 68, 68)"; // 빨간색 (심각한 문제)
  if (item.active === "pending") return "rgb(250, 204, 21)"; // 노란색 (경고)
  if (item.active === "null") return "rgb(229, 231, 235)"; // 연한 회색 (정보 없음)
};

const getLabelForHour = (index: number) => {
  if (index % 10 === 0 && index !== 0) return `${index}`;
  else return "";
};

const getBarHeightForHour = (item: TransactionData) => {
  const hourMinHeight = 30;
  const isActive = item.active === "true";
  return isActive ? barHeight : hourMinHeight;
};

const hoverContentForHour = (label: string, item: TransactionData) => {
  const message =
    item.active === "true"
      ? "active"
      : item.active === "temp"
      ? "dashboard failure"
      : item.active === "pending"
      ? "pending"
      : item.active === "null"
      ? "no data"
      : "failed";
  return `Minute: ${label}, Status: ${message}`;
};

export default function HourUptimeGraph({
  selectedHour,
  hourUptimeDataList,
  network,
}: {
  selectedHour: number;
  hourUptimeDataList: TransactionData[][];
  network: string;
}) {
  const [hoveredItem, setHoveredItem] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);

  const explorerURL =
    network === "ODIN"
      ? "https://9cscan.com/tx/"
      : "https://heimdall.9cscan.com/tx/";

  for (let minute = 0; minute < 60; minute++) {
    if (!hourUptimeDataList[selectedHour][minute]) {
      hourUptimeDataList[selectedHour][minute] = {
        active: "null",
        group_name: "",
        node_name: "",
        endpoint_url: "",
        txHash: "",
        timeStamp: "",
      };
    }
  }
  return (
    <div className="-mb-1">
      <h3 className="text-lg font-semibold">
        {selectedHour}:00 - {selectedHour + 1}:00 Uptime
      </h3>

      <div className="mt-3">
        <div className="grid grid-cols-60">
          {hourUptimeDataList[selectedHour]?.map((item, index) => (
            <div key={index} className="flex flex-col items-center">
              <div
                className="flex flex-col-reverse justify-start"
                style={{ height: barHeight }}
              >
                <a
                  key={index}
                  className="rounded cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredItem({
                      x: rect.x + window.scrollX + rect.width / 2,
                      y: rect.y + window.scrollY + rect.height + 8,
                      content: hoverContentForHour(index.toString(), item),
                    });
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                  href={
                    item.txHash !== ""
                      ? `${explorerURL}${item.txHash}`
                      : undefined
                  }
                  target="_blank"
                  style={{
                    width: barWidth,
                    height: getBarHeightForHour(item),
                    backgroundColor: getColorForHour(item),
                  }}
                />
              </div>
              <span className="text-sm text-center max-w-[13px] whitespace-nowrap mt-1">
                {getLabelForHour(index)}
              </span>
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
          {hoveredItem.content}
        </div>
      )}
    </div>
  );
}
