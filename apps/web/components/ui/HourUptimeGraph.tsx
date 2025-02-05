import { TransactionData } from "@/src/types";
import { useEffect, useState } from "react";

const getColorForHour = (item: TransactionData) => {
  if (item.active === "true") return "rgb(74, 222, 128)"; // 초록색 (정상)
  if (item.active === "false") return "rgb(239, 68, 68)"; // 빨간색 (심각한 문제)
  if (item.active === "delay") return "rgb(250, 204, 21)"; // 노란색 (지연 경고)
  if (item.active === "timeout") return "rgb(239, 68, 68)"; // 빨간색 (심각한 문제)
  /* errors */
  if (item.active === "pending") return "rgb(109, 111, 115)"; // 진한 회색 (지연 에러)
  if (item.active === "temp") return "rgb(109, 111, 115)"; // 진한 회색 (대시보드 실패)
  /*no data*/
  if (item.active === "null") return "rgb(229, 231, 235)"; // 연한 회색 (정보 없음)
};

const getLabelForHour = (index: number) => {
  if (index % 10 === 0 && index !== 0) return `${index}`;
  else return "";
};

const hoverContentForHour = (label: string, item: TransactionData) => {
  const statusMessage =
    item.active === "true"
      ? "active"
      : item.active === "temp"
      ? "dashboard error"
      : item.active === "pending"
      ? "pending" //보류
      : item.active === "null"
      ? "no data"
      : item.active === "timeout"
      ? "timeout"
      : item.active === "delay"
      ? "delayed"
      : "failed";
  const failLog = item.log ? item.log.split(",")[0] : null;
  return {
    label, // Minute 정보
    statusMessage: statusMessage, // 상태 메시지
    id: item.id,
    failLog: failLog, // 로그 정보
  };
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
    content: {
      label: string;
      statusMessage: string;
      failLog: string | null;
      id: number;
    };
  } | null>(null);
  const [barHeight, setBarHeight] = useState("35px");

  useEffect(() => {
    const updateHeight = () => {
      const width = window.innerWidth;
      if (width < 410) {
        setBarHeight("20px");
      } else if (width < 540) {
        setBarHeight("25px");
      } else if (width < 768) {
        setBarHeight("28px");
      } else if (width < 1024) {
        setBarHeight("32px");
      } else {
        setBarHeight("35px");
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

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
        id: 0,
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
                  className="rounded cursor-pointer w-[4px] min-[540px]:w-[5px] sm:w-[6px] md:w-[8px] lg:w-[11px] xl:w-[13px]"
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
                    height: barHeight,
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
          className="absolute bg-white p-2 rounded shadow-lg text-sm border border-gray-300 z-50"
          style={{
            left: `${hoveredItem.x}px`,
            top: `${hoveredItem.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          <p>
            <span>{`Minute: ${hoveredItem.content.label}, Status: ${hoveredItem.content.statusMessage}`}</span>
            <span className="text-gray-400">{`  (id: ${hoveredItem.content.id})`}</span>
          </p>
          {hoveredItem.content.failLog && (
            <div className="text-gray-700">{`log : ${hoveredItem.content.failLog}`}</div>
          )}
        </div>
      )}
    </div>
  );
}
