import { format } from "date-fns-tz";

export const toTimezoneDateString = (
  date: Date,
  userTimeZone: string
): string => {
  const value = format(date, "yyyy-MM-dd", { timeZone: userTimeZone }); // UTC → 로컬 타임존으로 변환 후 포맷
  return value;
};

export const toTimezoneHourNumber = (
  date: Date,
  userTimeZone: string
): number => {
  return parseInt(format(date, "HH", { timeZone: userTimeZone }), 10); // UTC → 로컬 타임존으로 변환 후 시간 추출
};

export const extractNodeNames = (url: string): string => {
  const urlParts = url.split("://")[1].split("."); // "https://subdomain.domain.com/graphql" → ["subdomain", "domain", "com"]
  return urlParts[0]; // subdomain (ex: "odin-rpc-1")
};
