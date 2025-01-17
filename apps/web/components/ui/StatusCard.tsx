import SectionWrapper from "@/components/layouts/SectionWrapper";
import { useTransactionCache } from "@/src/contexts/TransactionCacheContext";
import { useNodeContext } from "@/src/contexts/NodeContext";
import { useLoadingContext } from "@/src/contexts/LoadingContext";
import { useState, useEffect } from "react";
import { toTimezoneDateString, extractNodeNames } from "@/src/helper";

export default function StatusCard({
  network,
  tabBackgroundColor,
  setTabBackgroundColor,
}: {
  network: string;
  tabBackgroundColor: string;
  setTabBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { transactionCache } = useTransactionCache();
  const { nodeNames } = useNodeContext();
  const { isLoading } = useLoadingContext();
  const [isHealthy, setIsHealthy] = useState("true");
  const [falseNodes, setFalseNodes] = useState<string[]>([]);
  const [unknownNodes, setUnknownNodes] = useState<string[]>([]);

  useEffect(() => {
    // 오늘 날짜
    const today = new Date();
    const todayDate = toTimezoneDateString(today, 9);
    // 오늘 날짜의 노드 상태 가져오기
    const todayStatus = isLoading ? [] : transactionCache[todayDate] || [];
    const networkNodeNames = nodeNames[network] || [];

    const recentLimit = 5;
    const recentTime = today.getTime() - recentLimit * 60 * 1000;

    //5분 이내 데이터 중 가장 최근 데이터 조회
    const lastestNodeStatus = networkNodeNames.map((nodeName) => {
      const nodeStatus = todayStatus.findLast(
        (item) =>
          item.endpoint_url === nodeName &&
          new Date(item.timeStamp).getTime() > recentTime &&
          (item.active === "true" || item.active === "false")
      );
      return nodeStatus;
    });

    const newFalseNodes: string[] = [];
    const newUnknownNodes: string[] = [];
    let isHealthyState = "true";

    for (const [index, nodeStatus] of lastestNodeStatus.entries()) {
      if (isLoading) {
        isHealthyState = "true";
      } else if (!nodeStatus) {
        isHealthyState = "unknown";
        newUnknownNodes.push(networkNodeNames[index]);
      } else if (nodeStatus.active === "false") {
        isHealthyState = "false";
        newFalseNodes.push(networkNodeNames[index]);
      }
    }

    setIsHealthy(isHealthyState);
    setFalseNodes(newFalseNodes);
    setUnknownNodes(newUnknownNodes);

    const backgroundColor =
      isHealthy === "unknown"
        ? "bg-yellow-500"
        : isHealthy === "true"
        ? "bg-green-500"
        : "bg-red-500";

    setTabBackgroundColor(backgroundColor);
  }, [
    transactionCache,
    nodeNames,
    network,
    isHealthy,
    setTabBackgroundColor,
    isLoading,
  ]);

  const message =
    isHealthy === "unknown"
      ? `No data detected with ${network} in 5 minutes for the following nodes.`
      : isHealthy === "true"
      ? `No problems detected with ${network} right now.`
      : `Issues detected with ${network} for the following nodes.`;

  return (
    <SectionWrapper backgroundColor={tabBackgroundColor}>
      <div className="max-w-[1190px] mx-auto py-4">
        {/*TODO: 반응형으로 크기에 따라 조정*/}
        <h2 className="text-white font-bold">{message}</h2>
        <div className="flex flex-col gap-2">
          {isHealthy === "false" && (
            <div className="text-white text-sm mt-2">
              {falseNodes.map((node) => extractNodeNames(node)).join(", ")}
            </div>
          )}
          {isHealthy === "unknown" && (
            <div className="text-white text-sm mt-2">
              {unknownNodes.map((node) => extractNodeNames(node)).join(", ")}
            </div>
          )}
        </div>
      </div>
    </SectionWrapper>
  );
}
