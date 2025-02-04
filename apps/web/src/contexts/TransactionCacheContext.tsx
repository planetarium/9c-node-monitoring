import React, { createContext, useCallback, useContext, useRef } from "react";
import { TransactionData, TransactionCache } from "@/src/types";
import { useLoadingContext } from "@/src/contexts/LoadingContext";
import { useTimeZoneContext } from "@/src/contexts/TimezoneContext";
import { toTimezoneDateString } from "@/src/helper";
import { fromZonedTime } from "date-fns-tz";

type TransactionCacheContextType = {
  transactionCache: TransactionCache;
  fetchTransactionDataWithCache: (group: string, date: Date) => Promise<void>;
};

// Context 생성
const TransactionCacheContext = createContext<TransactionCacheContextType>({
  transactionCache: {},
  fetchTransactionDataWithCache: async () => {},
});

type TransactionCacheProviderProps = {
  children: React.ReactNode;
};

// 현지 시간 기준의 00:00:00 또는 23:59:59를 UTC로 변환
export const formatLocalDateToUTCDateTime = (
  date: string,
  range: "start" | "end"
): string => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const time = range === "start" ? "T00:00:00" : "T23:59:59.999";
  const localDateTime = `${date}${time}`;
  const utcDate = fromZonedTime(localDateTime, timeZone);

  return utcDate.toISOString();
};

const arrayToDateKeyMap = (
  data: TransactionData[],
  userTimeZone: string
): Record<string, TransactionData[]> => {
  return data.reduce((acc, item) => {
    const dateKey = toTimezoneDateString(
      new Date(item.timeStamp),
      userTimeZone
    ); // `timeStamp`를 현지 시간 기준 `YYYY-MM-DD`로 변환
    if (!acc[dateKey]) {
      acc[dateKey] = []; // 해당 날짜가 없으면 배열 초기화
    }
    acc[dateKey].push(item); // 날짜별로 데이터를 배열에 추가
    return acc;
  }, {} as Record<string, TransactionData[]>);
};

export const TransactionCacheProvider = ({
  children,
}: TransactionCacheProviderProps) => {
  const { incrementCount } = useLoadingContext();
  const { userTimeZone } = useTimeZoneContext();

  const transactionCacheRef = useRef<TransactionCache>({}); // 캐시 ref

  // 비동기 요청을 처리하는 함수
  // 하루가 들어올 경우 하루만 요청
  // 이틀이 들어올 경우, 연속적이지 않다는 가정 하에 나눠서 요청 (일반적으로 중앙값을 먼저 요청하므로)
  const fetchAndCacheTransactions = useCallback(
    async (group: string, dates: string[]) => {
      if (dates.length === 0) return;

      if (dates.length === 1) {
        // 단일 날짜 요청
        const startDateTime = formatLocalDateToUTCDateTime(dates[0], "start");
        const endDateTime = formatLocalDateToUTCDateTime(dates[0], "end");

        const response = await fetch(
          `${process.env.NEXT_API_URL}/transactions/status?group=${group}&start=${startDateTime}&end=${endDateTime}`
        );

        if (!response.ok) {
          console.error(`Error: ${response.status} - ${response.statusText}`);
          return null;
        }

        const fetchedData = await response.json();
        const groupedFetchedData = arrayToDateKeyMap(fetchedData, userTimeZone);

        // 캐시에 저장
        if (!transactionCacheRef.current[group]) {
          transactionCacheRef.current[group] = {};
        }

        transactionCacheRef.current[group][dates[0]] =
          groupedFetchedData[dates[0]] || [];
      } else if (dates.length === 2) {
        // 두 날짜 요청
        const startDateTime1 = formatLocalDateToUTCDateTime(dates[0], "start");
        const endDateTime1 = formatLocalDateToUTCDateTime(dates[0], "end");

        const startDateTime2 = formatLocalDateToUTCDateTime(dates[1], "start");
        const endDateTime2 = formatLocalDateToUTCDateTime(dates[1], "end");

        const response = await fetch(
          `${process.env.NEXT_API_URL}/transactions/status?group=${group}&start=${startDateTime1}&end=${endDateTime1}&start2=${startDateTime2}&end2=${endDateTime2}`
        );

        if (!response.ok) {
          console.error(`Error: ${response.status} - ${response.statusText}`);
          return null;
        }

        const fetchedData = await response.json();
        const groupedFetchedData = arrayToDateKeyMap(fetchedData, userTimeZone);

        // 캐시에 저장
        if (!transactionCacheRef.current[group]) {
          transactionCacheRef.current[group] = {};
        }

        dates.forEach((date) => {
          transactionCacheRef.current[group][date] =
            groupedFetchedData[date] || [];
        });
      }

      incrementCount();
    },
    [incrementCount, userTimeZone]
  );

  //오늘 데이터 중 바뀔 가능성이 있는 부분만 받아오는 함수
  const fetchLatestTransactionUpdates = useCallback(
    async (group: string) => {
      const todayKey = toTimezoneDateString(new Date(), userTimeZone);
      const yesterdayKey = toTimezoneDateString(
        new Date(new Date().setDate(new Date().getDate() - 1)),
        userTimeZone
      );

      if (!transactionCacheRef.current[group]) {
        transactionCacheRef.current[group] = {};
      }

      if (!transactionCacheRef.current[group][todayKey]) {
        transactionCacheRef.current[group][todayKey] = [];
      }

      const cachedTransactions =
        transactionCacheRef.current[group]?.[todayKey] || [];

      // 오늘 00:00:00(local time)의 UTC 기준 타임스탬프
      const todayMidnightLocal = new Date();
      todayMidnightLocal.setHours(0, 0, 0, 0);
      const todayMidnightUTC = new Date(
        formatLocalDateToUTCDateTime(
          toTimezoneDateString(todayMidnightLocal, userTimeZone),
          "start"
        )
      );

      // 마지막 요소의 timestamp 사용 (정렬되어 있다고 가정)
      const lastFetchedTimestamp =
        cachedTransactions.length > 0
          ? new Date(
              cachedTransactions[cachedTransactions.length - 1].timeStamp
            )
          : null;

      const fetchStartDate = lastFetchedTimestamp
        ? new Date(lastFetchedTimestamp.getTime() - 5 * 60 * 1000) // 최종 데이터 5분 전까지 가져오기
        : todayMidnightUTC; // 캐시가 없으면 00:00:00부터 가져오기
      const fetchStartTime = fetchStartDate.toISOString();
      const fetchEndTime = new Date().toISOString();

      const response = await fetch(
        `${process.env.NEXT_API_URL}/transactions/status?group=${group}&start=${fetchStartTime}&end=${fetchEndTime}`
      );

      if (!response.ok) {
        console.error(`Error: ${response.status} - ${response.statusText}`);
        return;
      }

      const newTransactions: TransactionData[] = await response.json();

      if (newTransactions.length > 0) {
        // 00:00:00(local time) 기준으로 데이터 나누기
        const yesterdayData = newTransactions.filter(
          (t) => new Date(t.timeStamp) < todayMidnightUTC
        );

        const todayData = newTransactions.filter(
          (t) => new Date(t.timeStamp) >= todayMidnightUTC
        );

        if (yesterdayData.length > 0) {
          // 최신 데이터가 정각을 기준으로 나눠진다면
          // 기존 캐시의 전날 데이터와 병합
          // 기존 캐시의 전날 데이터에서 fetchStartTime 이전 데이터까지만 유지
          const trimmedYesterdayTransactions = trimTransactionsByTime(
            transactionCacheRef.current[group]?.[yesterdayKey] || [],
            fetchStartDate
          );

          // 잘린 데이터 + 새로운 yesterdayData 병합
          transactionCacheRef.current[group][yesterdayKey] = [
            ...trimmedYesterdayTransactions,
            ...yesterdayData,
          ];
          // 오늘 데이터는 새로 덮어쓰기
          transactionCacheRef.current[group][todayKey] = todayData;
        } else {
          if (fetchStartTime) {
            const trimmedCachedTransactions = trimTransactionsByTime(
              cachedTransactions,
              fetchStartDate
            );

            transactionCacheRef.current[group][todayKey] = [
              ...trimmedCachedTransactions,
              ...todayData,
            ];
          } else {
            // 캐시가 비어 있는 경우 그대로 병합
            transactionCacheRef.current[group][todayKey] = [...todayData];
          }
        }
      }

      //console.log("data", transactionCacheRef.current[group]);
    },
    [userTimeZone]
  );

  const trimTransactionsByTime = (
    transactions: TransactionData[],
    cutoffDate: Date
  ) => {
    let cutIndex = transactions.length; // 기본적으로 전체 유지

    for (let i = transactions.length - 1; i >= 0; i--) {
      const txTime = new Date(transactions[i].timeStamp);
      if (txTime < cutoffDate) {
        cutIndex = i + 1; // fetchStartTime 이전 데이터까지만 유지
        break;
      }
    }

    return transactions.slice(0, cutIndex);
  };

  const fetchTransactionDataWithCache = useCallback(
    async (group: string, date: Date) => {
      //console.log("fetchTransactionDataWithCache", group, date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 현지 시간 기준 오늘 00:00:00

      const prevDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
      prevDate.setHours(0, 0, 0, 0); // 현지 시간 기준 전날  00:00:00
      const currentDate = new Date(date.getTime());
      currentDate.setHours(0, 0, 0, 0); // 현지 시간 기준 오늘 00:00:00
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      nextDate.setHours(0, 0, 0, 0); // 현지 시간 기준 다음날 00:00:00

      //console.log("prevDate", prevDate);
      //console.log("nextDate", nextDate);

      const dateKeysUntilToday = [prevDate, currentDate, nextDate]
        .filter((d) => d <= today)
        .map((d) => toTimezoneDateString(d, userTimeZone));

      // 즉시 가져올 데이터
      const immediateDates = dateKeysUntilToday.filter(
        (dateKey) =>
          dateKey === toTimezoneDateString(currentDate, userTimeZone) && // current만 가져오되,
          (dateKey === toTimezoneDateString(today, userTimeZone) || // current가 오늘이라면 무조건 가져오고
            !transactionCacheRef.current[group]?.[dateKey]) // 그렇지 않으면 캐시 여부 확인
      );

      // 천천히 가져올 데이터
      const laterDates = dateKeysUntilToday.filter(
        (dateKey) =>
          dateKey !== toTimezoneDateString(currentDate, userTimeZone) && // current가 아닌 날짜
          !transactionCacheRef.current[group]?.[dateKey] // 캐시에 없는 경우만
      );

      if (immediateDates.length > 0) {
        if (immediateDates[0] === toTimezoneDateString(today, userTimeZone)) {
          await fetchLatestTransactionUpdates(group); // 오늘이라면 동기적으로 최신 데이터만
        } else {
          await fetchAndCacheTransactions(group, immediateDates); // 아니라면 동기적으로 모든 데이터
        }
      }

      if (laterDates.length > 0) {
        fetchAndCacheTransactions(group, laterDates); // 비동기 실행
      }

      if (immediateDates[0] !== toTimezoneDateString(today, userTimeZone)) {
        //만약 오늘 데이터 가져오지 않았다면 비동기로 처리
        fetchLatestTransactionUpdates(group);
      }
    },
    [fetchAndCacheTransactions, fetchLatestTransactionUpdates, userTimeZone]
  );

  return (
    <TransactionCacheContext.Provider
      value={{
        transactionCache: transactionCacheRef.current,
        fetchTransactionDataWithCache,
      }}
    >
      {children}
    </TransactionCacheContext.Provider>
  );
};

// useTransactionCache Hook
export const useTransactionCache = (): TransactionCacheContextType => {
  const context = useContext(TransactionCacheContext);
  if (!context) {
    throw new Error(
      "useTransactionCache must be used within a TransactionCacheProvider"
    );
  }
  return context;
};
