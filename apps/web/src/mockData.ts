// mockData.ts
import { NodeHealth } from "./types";

const generateMockData = (): NodeHealth[] => {
  const networks = ["ODIN", "HEIMDAL"];
  const nodes = Array.from({ length: 5 }, (_, i) => i + 1);
  const currentTime = new Date();
  const mockData: NodeHealth[] = [];

  networks.forEach((network) => {
    nodes.forEach((node) => {
      for (let i = 0; i < 24; i++) {
        const timeStamp = new Date(currentTime);
        timeStamp.setHours(currentTime.getHours() - i);
        timeStamp.setMinutes(0);
        timeStamp.setSeconds(0);

        // 확률에 따라 active:true 개수 결정
        const randomPercentage = Math.random() * 100;
        let activeCountRange: [number, number];

        if (randomPercentage < 70) {
          activeCountRange = [57, 60]; // 70% 확률로 57~60개
        } else if (randomPercentage < 90) {
          activeCountRange = [42, 56]; // 20% 확률로 42~56개
        } else {
          activeCountRange = [0, 41]; // 10% 확률로 0~41개
        }

        const activeCount =
          Math.floor(
            Math.random() * (activeCountRange[1] - activeCountRange[0] + 1)
          ) + activeCountRange[0];

        // 60개의 데이터를 생성하며 active 설정
        for (let j = 0; j < 60; j++) {
          const isActive = j < activeCount; // active 상태 결정

          mockData.push({
            id: mockData.length + 1,
            group_name: network,
            node_name: `${node}`,
            endpoint_url: `https://${network.toLowerCase()}-${node}.example.com`,
            timeStamp: timeStamp.toISOString(),
            txHash: `txHash_${Math.floor(Math.random() * 9000) + 1000}`,
            active: isActive ? "true" : "false", // true 또는 false
            log: `Log entry for ${network}-${node} at ${timeStamp.toISOString()}`,
            updatedAt: new Date(
              timeStamp.getTime() + Math.floor(Math.random() * 3600000)
            ).toISOString(),
          });
        }
      }
    });
  });

  return mockData;
};

export const mockNodeHealthData = generateMockData();
