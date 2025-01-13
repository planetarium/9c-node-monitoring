import SectionWrapper from "../layouts/SectionWrapper";
import DayUptimeGraph from "./DayUptimeGraph";
import HourUptimeGraph from "./HourUptimeGraph";
import { useState, useEffect } from "react";
import { useTransactionCache } from "@/src/contexts/TransactionCacheContext";
import { DayUptimeEntry, TransactionData } from "@/src/types";

export default function DayUptimeSection({
  network,
  node,
  isBox,
  date,
  setDate,
  globalSelectedHour,
  setGlobalSelectedHour,
}: {
  network: string;
  node?: string;
  isBox: boolean;
  date: Date;
  setDate: React.Dispatch<React.SetStateAction<Date>>;
  globalSelectedHour: number | null;
  setGlobalSelectedHour: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  const isSection = !isBox;
  const [selectedHour, setSelectedHour] = useState<number | null>(
    isBox ? null : 23 //배너 형태면 최신 분까지 펼쳐서 보여주기 위해 23시로 설정
  );
  const { transactionCache } = useTransactionCache();

  const handleGraphClick = (hour: number | null) => {
    setSelectedHour((prev) => (prev === hour ? null : hour)); // 같은 시간 클릭 시 닫기
  };

  const handleCentralGraphClick = (hour: number | null) => {
    setGlobalSelectedHour((prev) => (prev === hour ? null : hour)); // 같은 시간 클릭 시 닫기
    setSelectedHour((prev) => (prev === hour ? null : hour)); // 같은 시간 클릭 시 닫기
  };

  useEffect(() => {
    setSelectedHour(globalSelectedHour);
  }, [globalSelectedHour]);

  // 중앙 도메인 이름 추출 함수
  const extractNodeNames = (url: string): string => {
    const urlParts = url.split("://")[1].split("."); // "https://subdomain.domain.com/graphql" → ["subdomain", "domain", "com"]
    return urlParts[0]; // subdomain (ex: "odin-rpc-1")
  };

  const networkName = node ? extractNodeNames(node) : network;

  /* 데이터 관리 파트 */
  const dateString = date.toISOString().split("T")[0];
  const selectedDateData = transactionCache[dateString] ?? [];
  const filteredData = node
    ? selectedDateData?.filter((item) => item.endpoint_url === node) ?? []
    : selectedDateData?.filter(
        (item) => item.group_name === network.toLowerCase()
      );

  const initialDayUptimeEntry: DayUptimeEntry = {
    hour: 0,
    pending: 0,
    temp: 0,
    false: 0,
    true: 0,
    null: 0,
    total: 0,
  };

  type UptimeDataAccumulator = {
    dayUptimeData: DayUptimeEntry[]; // 각 시간대별 상태 개수
    hourUptimeDataList: TransactionData[][]; // 각 시간대별 데이터 배열
  };

  const { dayUptimeData, hourUptimeDataList } =
    filteredData.reduce<UptimeDataAccumulator>(
      (acc, item) => {
        const utcDate = new Date(item.timeStamp);
        const hour = (utcDate.getUTCHours() + 9) % 24;
        const minute = utcDate.getMinutes();

        // 시간대별 초기화
        if (!acc.dayUptimeData[hour]) {
          acc.dayUptimeData[hour] = { ...initialDayUptimeEntry };
          acc.dayUptimeData[hour].hour = hour;
        }

        // 노드별 카운트 증가
        acc.dayUptimeData[hour][item.active] += 1;
        acc.dayUptimeData[hour].total += 1;

        // 시간대별 데이터 배열에 추가
        if (!acc.hourUptimeDataList[hour]) {
          acc.hourUptimeDataList[hour] = [];
        }
        acc.hourUptimeDataList[hour][minute] = item;

        return acc;
      },
      {
        dayUptimeData: Array(24)
          .fill(null)
          .map(() => ({ ...initialDayUptimeEntry })),
        hourUptimeDataList: Array(24)
          .fill(null)
          .map(() => []),
      }
    );

  return (
    <div>
      <SectionWrapper backgroundColor="bg-white" isBox={isBox}>
        <div className="pt-2 pb-4">
          <DayUptimeGraph
            onBarClick={isSection ? handleCentralGraphClick : handleGraphClick}
            selectedHour={selectedHour}
            network={networkName}
            date={date}
            setDate={setDate}
            node={node || "all"}
            dayUptimeData={dayUptimeData}
          />
        </div>
        {node && selectedHour !== null && (
          <div className="pt-6 pb-4">
            <HourUptimeGraph
              selectedHour={selectedHour}
              network={network}
              hourUptimeDataList={hourUptimeDataList}
            />
          </div>
        )}
        {isSection && <div className="pb-6" />}
      </SectionWrapper>
    </div>
  );
}