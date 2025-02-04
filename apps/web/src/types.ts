// types.ts

export interface NodeHealth {
  id: number;
  group_name: string;
  node_name: string; // 추가됨: 노드 이름 필드
  endpoint_url: string;
  timeStamp: string; // ISO 형식 문자열
  txHash: string;
  active: "temp" | "false" | "true"; // 가능한 상태를 리터럴 타입으로 지정
  log?: string; // nullable field
  updatedAt: string; // ISO 형식 문자열
}

export type TransactionData = {
  // updatedAt 제외한 NodeHealth 타입
  id: number;
  group_name: string;
  node_name: string;
  endpoint_url: string;
  txHash: string;
  active: "temp" | "false" | "true" | "pending" | "null" | "timeout" | "delay";
  log?: string;
  timeStamp: string;
};

export type DayUptimeEntry = {
  hour: number;
  pending: number;
  temp: number;
  false: number;
  true: number;
  timeout: number;
  delay: number;
  total: number;
  null: number;
};

export type TransactionCache = Record<
  string,
  Record<string, TransactionData[]>
>;
